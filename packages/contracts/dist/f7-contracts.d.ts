import { z } from "zod";
import type { WorksheetSelectionConfirmation } from "./contracts.js";
export declare const F7_SELECTION_NORMAL_SKEWNESS_MAX = 0.5;
export declare const F7_SELECTION_NORMAL_COEFFICIENT_OF_VARIATION_MAX = 0.1;
export declare const F7_SELECTION_NORMAL_MEAN_MEDIAN_RELATIVE_DIFFERENCE_MAX = 0.02;
export declare const F7_SELECTION_NORMAL_QQ_CURVATURE_MAX = 0.1;
export declare const f7LoopCoefficientSchema: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<0>, z.ZodLiteral<1>]>;
export declare const f7FactorSourceModeSchema: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
export declare const f7MeasurementStructureSchema: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
export declare const f7RationalSubgroupEstimatorSchema: z.ZodEnum<["RANGE_D2", "S_C4"]>;
export declare const f7RationalSubgroupConfigSchema: z.ZodObject<{
    subgroupSize: z.ZodNumber;
    estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
}, "strict", z.ZodTypeAny, {
    subgroupSize: number;
    estimator: "RANGE_D2" | "S_C4";
}, {
    subgroupSize: number;
    estimator: "RANGE_D2" | "S_C4";
}>;
export declare const f7MsaStatusSchema: z.ZodEnum<["available", "not_available", "unknown"]>;
export declare const f7ToleranceDistributionSchema: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
export declare const f7BaselineSamplerSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"samplerId", [z.ZodObject<{
    samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
    physicalMean: z.ZodNumber;
    standardDeviation: z.ZodNumber;
    support: z.ZodLiteral<"REAL">;
}, "strict", z.ZodTypeAny, {
    standardDeviation: number;
    samplerId: "NORMAL_LOCATION_SCALE_V1";
    physicalMean: number;
    support: "REAL";
}, {
    standardDeviation: number;
    samplerId: "NORMAL_LOCATION_SCALE_V1";
    physicalMean: number;
    support: "REAL";
}>, z.ZodObject<{
    samplerId: z.ZodLiteral<"UNIFORM_BOUNDED_V1">;
    physicalMean: z.ZodNumber;
    standardDeviation: z.ZodNumber;
    minimum: z.ZodNumber;
    maximum: z.ZodNumber;
    support: z.ZodLiteral<"BOUNDED_REAL">;
}, "strict", z.ZodTypeAny, {
    minimum: number;
    maximum: number;
    standardDeviation: number;
    samplerId: "UNIFORM_BOUNDED_V1";
    physicalMean: number;
    support: "BOUNDED_REAL";
}, {
    minimum: number;
    maximum: number;
    standardDeviation: number;
    samplerId: "UNIFORM_BOUNDED_V1";
    physicalMean: number;
    support: "BOUNDED_REAL";
}>]>, {
    standardDeviation: number;
    samplerId: "NORMAL_LOCATION_SCALE_V1";
    physicalMean: number;
    support: "REAL";
} | {
    minimum: number;
    maximum: number;
    standardDeviation: number;
    samplerId: "UNIFORM_BOUNDED_V1";
    physicalMean: number;
    support: "BOUNDED_REAL";
}, {
    standardDeviation: number;
    samplerId: "NORMAL_LOCATION_SCALE_V1";
    physicalMean: number;
    support: "REAL";
} | {
    minimum: number;
    maximum: number;
    standardDeviation: number;
    samplerId: "UNIFORM_BOUNDED_V1";
    physicalMean: number;
    support: "BOUNDED_REAL";
}>;
export declare const f7FactorCandidateSchema: z.ZodEffects<z.ZodObject<{
    longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
    sigmaLevel: z.ZodOptional<z.ZodNumber>;
    standardDeviation: z.ZodNumber;
    distribution: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
    lowerSpecLimit: z.ZodNumber;
    upperSpecLimit: z.ZodNumber;
    designNominal: z.ZodNumber;
    upperTolerance: z.ZodNumber;
    lowerTolerance: z.ZodNumber;
    workbookContentHash: z.ZodString;
    worksheetName: z.ZodString;
    tableId: z.ZodString;
    sourceRow: z.ZodNumber;
    sourceCells: z.ZodRecord<z.ZodString, z.ZodString>;
    factorCandidateId: z.ZodString;
    factorName: z.ZodString;
    userAdded: z.ZodOptional<z.ZodLiteral<true>>;
    workbookUnitEvidence: z.ZodOptional<z.ZodString>;
    excelSignedMean: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    upperTolerance: number;
    lowerTolerance: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    standardDeviation: number;
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    excelSignedMean: number;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    userAdded?: true | undefined;
    workbookUnitEvidence?: string | undefined;
}, {
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    upperTolerance: number;
    lowerTolerance: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    standardDeviation: number;
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    excelSignedMean: number;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    userAdded?: true | undefined;
    workbookUnitEvidence?: string | undefined;
}>, {
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    upperTolerance: number;
    lowerTolerance: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    standardDeviation: number;
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    excelSignedMean: number;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    userAdded?: true | undefined;
    workbookUnitEvidence?: string | undefined;
}, {
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    upperTolerance: number;
    lowerTolerance: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    standardDeviation: number;
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    excelSignedMean: number;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    userAdded?: true | undefined;
    workbookUnitEvidence?: string | undefined;
}>;
export declare const f7FactorSetupConfirmationSchema: z.ZodEffects<z.ZodObject<{
    longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
    sigmaLevel: z.ZodOptional<z.ZodNumber>;
    distribution: z.ZodOptional<z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>>;
    confirmed: z.ZodLiteral<true>;
    designNominal: z.ZodNumber;
    upperTolerance: z.ZodNumber;
    lowerTolerance: z.ZodNumber;
    factorCandidateId: z.ZodString;
    factorName: z.ZodOptional<z.ZodString>;
    userAdded: z.ZodOptional<z.ZodLiteral<true>>;
}, "strict", z.ZodTypeAny, {
    confirmed: true;
    upperTolerance: number;
    lowerTolerance: number;
    designNominal: number;
    factorCandidateId: string;
    factorName?: string | undefined;
    distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    userAdded?: true | undefined;
}, {
    confirmed: true;
    upperTolerance: number;
    lowerTolerance: number;
    designNominal: number;
    factorCandidateId: string;
    factorName?: string | undefined;
    distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    userAdded?: true | undefined;
}>, {
    confirmed: true;
    upperTolerance: number;
    lowerTolerance: number;
    designNominal: number;
    factorCandidateId: string;
    factorName?: string | undefined;
    distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    userAdded?: true | undefined;
}, {
    confirmed: true;
    upperTolerance: number;
    lowerTolerance: number;
    designNominal: number;
    factorCandidateId: string;
    factorName?: string | undefined;
    distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    userAdded?: true | undefined;
}>;
export declare const f7UnitSourceSchema: z.ZodEnum<["workbook", "user_confirmed", "unspecified"]>;
export declare const f7FactorEvidenceSchema: z.ZodEffects<z.ZodObject<{
    loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<0>, z.ZodLiteral<1>]>;
    physicalMean: z.ZodNumber;
    signedContributionMean: z.ZodNumber;
    baselineSampler: z.ZodEffects<z.ZodDiscriminatedUnion<"samplerId", [z.ZodObject<{
        samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
        physicalMean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        support: z.ZodLiteral<"REAL">;
    }, "strict", z.ZodTypeAny, {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    }, {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    }>, z.ZodObject<{
        samplerId: z.ZodLiteral<"UNIFORM_BOUNDED_V1">;
        physicalMean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        minimum: z.ZodNumber;
        maximum: z.ZodNumber;
        support: z.ZodLiteral<"BOUNDED_REAL">;
    }, "strict", z.ZodTypeAny, {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    }, {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    }>]>, {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    }, {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    }>;
    lowerSpecLimit: z.ZodNumber;
    upperSpecLimit: z.ZodNumber;
    calculatedMean: z.ZodNumber;
    tolerance: z.ZodNumber;
    oneSigma: z.ZodNumber;
    percentContributionToSigma: z.ZodNumber;
    longTermSafetyFactor: z.ZodNumber;
    sigmaLevel: z.ZodNumber;
    distribution: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
    designNominal: z.ZodNumber;
    upperTolerance: z.ZodNumber;
    lowerTolerance: z.ZodNumber;
    workbookContentHash: z.ZodString;
    worksheetName: z.ZodString;
    tableId: z.ZodString;
    sourceRow: z.ZodNumber;
    sourceCells: z.ZodRecord<z.ZodString, z.ZodString>;
    factorCandidateId: z.ZodString;
    factorId: z.ZodString;
    factorName: z.ZodString;
    userAdded: z.ZodOptional<z.ZodLiteral<true>>;
    unit: z.ZodString;
    unitSource: z.ZodEnum<["workbook", "user_confirmed", "unspecified"]>;
}, "strict", z.ZodTypeAny, {
    unit: string;
    tolerance: number;
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    upperTolerance: number;
    lowerTolerance: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    oneSigma: number;
    percentContributionToSigma: number;
    longTermSafetyFactor: number;
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sigmaLevel: number;
    sourceCells: Record<string, string>;
    physicalMean: number;
    factorCandidateId: string;
    factorId: string;
    unitSource: "workbook" | "user_confirmed" | "unspecified";
    loopCoefficient: 0 | 1 | -1;
    signedContributionMean: number;
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    };
    calculatedMean: number;
    userAdded?: true | undefined;
}, {
    unit: string;
    tolerance: number;
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    upperTolerance: number;
    lowerTolerance: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    oneSigma: number;
    percentContributionToSigma: number;
    longTermSafetyFactor: number;
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sigmaLevel: number;
    sourceCells: Record<string, string>;
    physicalMean: number;
    factorCandidateId: string;
    factorId: string;
    unitSource: "workbook" | "user_confirmed" | "unspecified";
    loopCoefficient: 0 | 1 | -1;
    signedContributionMean: number;
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    };
    calculatedMean: number;
    userAdded?: true | undefined;
}>, {
    unit: string;
    tolerance: number;
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    upperTolerance: number;
    lowerTolerance: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    oneSigma: number;
    percentContributionToSigma: number;
    longTermSafetyFactor: number;
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sigmaLevel: number;
    sourceCells: Record<string, string>;
    physicalMean: number;
    factorCandidateId: string;
    factorId: string;
    unitSource: "workbook" | "user_confirmed" | "unspecified";
    loopCoefficient: 0 | 1 | -1;
    signedContributionMean: number;
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    };
    calculatedMean: number;
    userAdded?: true | undefined;
}, {
    unit: string;
    tolerance: number;
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    upperTolerance: number;
    lowerTolerance: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    oneSigma: number;
    percentContributionToSigma: number;
    longTermSafetyFactor: number;
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sigmaLevel: number;
    sourceCells: Record<string, string>;
    physicalMean: number;
    factorCandidateId: string;
    factorId: string;
    unitSource: "workbook" | "user_confirmed" | "unspecified";
    loopCoefficient: 0 | 1 | -1;
    signedContributionMean: number;
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    };
    calculatedMean: number;
    userAdded?: true | undefined;
}>;
export declare const f7ObservationDispositionSchema: z.ZodEnum<["included", "excluded"]>;
export declare const f7ExclusionReasonSchema: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
export declare const f7ObservationSchema: z.ZodDiscriminatedUnion<"disposition", [z.ZodObject<{
    disposition: z.ZodLiteral<"included">;
    value: z.ZodNumber;
    originalRow: z.ZodNumber;
    sequence: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
    subgroup: z.ZodOptional<z.ZodString>;
    batch: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    value: number;
    disposition: "included";
    originalRow: number;
    sequence?: string | undefined;
    timestamp?: string | undefined;
    subgroup?: string | undefined;
    batch?: string | undefined;
}, {
    value: number;
    disposition: "included";
    originalRow: number;
    sequence?: string | undefined;
    timestamp?: string | undefined;
    subgroup?: string | undefined;
    batch?: string | undefined;
}>, z.ZodObject<{
    disposition: z.ZodLiteral<"excluded">;
    reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
    operatorReference: z.ZodString;
    confirmed: z.ZodLiteral<true>;
    value: z.ZodNumber;
    originalRow: z.ZodNumber;
    sequence: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
    subgroup: z.ZodOptional<z.ZodString>;
    batch: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    value: number;
    confirmed: true;
    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
    disposition: "excluded";
    originalRow: number;
    operatorReference: string;
    sequence?: string | undefined;
    timestamp?: string | undefined;
    subgroup?: string | undefined;
    batch?: string | undefined;
}, {
    value: number;
    confirmed: true;
    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
    disposition: "excluded";
    originalRow: number;
    operatorReference: string;
    sequence?: string | undefined;
    timestamp?: string | undefined;
    subgroup?: string | undefined;
    batch?: string | undefined;
}>]>;
export declare const f7RejectionReasonSchema: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
export declare const f7RejectionSummarySchema: z.ZodObject<{
    rowNumber: z.ZodNumber;
    reason: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
}, "strict", z.ZodTypeAny, {
    reason: "non_finite_value" | "invalid_row" | "missing_value";
    rowNumber: number;
}, {
    reason: "non_finite_value" | "invalid_row" | "missing_value";
    rowNumber: number;
}>;
export declare const F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS = 500;
export declare const f7MeasurementDatasetSchema: z.ZodEffects<z.ZodObject<{
    factorId: z.ZodString;
    unit: z.ZodString;
    structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
    rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
        subgroupSize: z.ZodNumber;
        estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
    }, "strict", z.ZodTypeAny, {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    }, {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    }>>;
    sourceReference: z.ZodString;
    importedAt: z.ZodString;
    msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
    observations: z.ZodArray<z.ZodDiscriminatedUnion<"disposition", [z.ZodObject<{
        disposition: z.ZodLiteral<"included">;
        value: z.ZodNumber;
        originalRow: z.ZodNumber;
        sequence: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodOptional<z.ZodString>;
        subgroup: z.ZodOptional<z.ZodString>;
        batch: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        value: number;
        disposition: "included";
        originalRow: number;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    }, {
        value: number;
        disposition: "included";
        originalRow: number;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    }>, z.ZodObject<{
        disposition: z.ZodLiteral<"excluded">;
        reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
        operatorReference: z.ZodString;
        confirmed: z.ZodLiteral<true>;
        value: z.ZodNumber;
        originalRow: z.ZodNumber;
        sequence: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodOptional<z.ZodString>;
        subgroup: z.ZodOptional<z.ZodString>;
        batch: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        value: number;
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        disposition: "excluded";
        originalRow: number;
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    }, {
        value: number;
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        disposition: "excluded";
        originalRow: number;
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    }>]>, "many">;
    missingRowCount: z.ZodNumber;
    rejectionSummaries: z.ZodArray<z.ZodObject<{
        rowNumber: z.ZodNumber;
        reason: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
    }, "strict", z.ZodTypeAny, {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }, {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }>, "many">;
    originalRowCount: z.ZodNumber;
    analyzedCount: z.ZodNumber;
    contentHash: z.ZodString;
}, "strict", z.ZodTypeAny, {
    unit: string;
    contentHash: string;
    observations: ({
        value: number;
        disposition: "included";
        originalRow: number;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    } | {
        value: number;
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        disposition: "excluded";
        originalRow: number;
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    })[];
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    importedAt: string;
    msaStatus: "unknown" | "available" | "not_available";
    missingRowCount: number;
    rejectionSummaries: {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }[];
    originalRowCount: number;
    analyzedCount: number;
    rationalSubgroupConfig?: {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    } | undefined;
}, {
    unit: string;
    contentHash: string;
    observations: ({
        value: number;
        disposition: "included";
        originalRow: number;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    } | {
        value: number;
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        disposition: "excluded";
        originalRow: number;
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    })[];
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    importedAt: string;
    msaStatus: "unknown" | "available" | "not_available";
    missingRowCount: number;
    rejectionSummaries: {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }[];
    originalRowCount: number;
    analyzedCount: number;
    rationalSubgroupConfig?: {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    } | undefined;
}>, {
    unit: string;
    contentHash: string;
    observations: ({
        value: number;
        disposition: "included";
        originalRow: number;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    } | {
        value: number;
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        disposition: "excluded";
        originalRow: number;
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    })[];
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    importedAt: string;
    msaStatus: "unknown" | "available" | "not_available";
    missingRowCount: number;
    rejectionSummaries: {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }[];
    originalRowCount: number;
    analyzedCount: number;
    rationalSubgroupConfig?: {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    } | undefined;
}, {
    unit: string;
    contentHash: string;
    observations: ({
        value: number;
        disposition: "included";
        originalRow: number;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    } | {
        value: number;
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        disposition: "excluded";
        originalRow: number;
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    })[];
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    importedAt: string;
    msaStatus: "unknown" | "available" | "not_available";
    missingRowCount: number;
    rejectionSummaries: {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }[];
    originalRowCount: number;
    analyzedCount: number;
    rationalSubgroupConfig?: {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    } | undefined;
}>;
export declare const f7FactorInputSchema: z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
    mode: z.ZodLiteral<"MEASURED">;
    dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        factorId: z.ZodString;
        unit: z.ZodString;
        structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
        rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
            subgroupSize: z.ZodNumber;
            estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
        }, "strict", z.ZodTypeAny, {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        }, {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        }>>;
        sourceReference: z.ZodString;
        importedAt: z.ZodString;
        msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
        observations: z.ZodArray<z.ZodDiscriminatedUnion<"disposition", [z.ZodObject<{
            disposition: z.ZodLiteral<"included">;
            value: z.ZodNumber;
            originalRow: z.ZodNumber;
            sequence: z.ZodOptional<z.ZodString>;
            timestamp: z.ZodOptional<z.ZodString>;
            subgroup: z.ZodOptional<z.ZodString>;
            batch: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }, {
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }>, z.ZodObject<{
            disposition: z.ZodLiteral<"excluded">;
            reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
            operatorReference: z.ZodString;
            confirmed: z.ZodLiteral<true>;
            value: z.ZodNumber;
            originalRow: z.ZodNumber;
            sequence: z.ZodOptional<z.ZodString>;
            timestamp: z.ZodOptional<z.ZodString>;
            subgroup: z.ZodOptional<z.ZodString>;
            batch: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }, {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }>]>, "many">;
        missingRowCount: z.ZodNumber;
        rejectionSummaries: z.ZodArray<z.ZodObject<{
            rowNumber: z.ZodNumber;
            reason: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
        }, "strict", z.ZodTypeAny, {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }, {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }>, "many">;
        originalRowCount: z.ZodNumber;
        analyzedCount: z.ZodNumber;
        contentHash: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }, {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }>, {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }, {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    mode: "MEASURED";
    dataset?: {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    } | undefined;
}, {
    mode: "MEASURED";
    dataset?: {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    } | undefined;
}>, z.ZodObject<{
    mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
    baselineSampler: z.ZodEffects<z.ZodDiscriminatedUnion<"samplerId", [z.ZodObject<{
        samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
        physicalMean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        support: z.ZodLiteral<"REAL">;
    }, "strict", z.ZodTypeAny, {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    }, {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    }>, z.ZodObject<{
        samplerId: z.ZodLiteral<"UNIFORM_BOUNDED_V1">;
        physicalMean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        minimum: z.ZodNumber;
        maximum: z.ZodNumber;
        support: z.ZodLiteral<"BOUNDED_REAL">;
    }, "strict", z.ZodTypeAny, {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    }, {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    }>]>, {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    }, {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    }>;
}, "strict", z.ZodTypeAny, {
    mode: "BASELINE_ASSUMPTION";
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    };
}, {
    mode: "BASELINE_ASSUMPTION";
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    } | {
        minimum: number;
        maximum: number;
        standardDeviation: number;
        samplerId: "UNIFORM_BOUNDED_V1";
        physicalMean: number;
        support: "BOUNDED_REAL";
    };
}>]>;
export declare const f7DatasetValidationReasonSchema: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
export declare const f7DatasetValidationIssueReasonSchema: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
export declare const f7DatasetValidationIssueSchema: z.ZodObject<{
    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
    factorId: z.ZodOptional<z.ZodString>;
    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
}, "strict", z.ZodTypeAny, {
    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
    factorId?: string | undefined;
    rowNumbers?: number[] | undefined;
}, {
    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
    factorId?: string | undefined;
    rowNumbers?: number[] | undefined;
}>;
export declare const f7CandidateEligibilityFlagSchema: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
export declare const f7CandidateEligibilitySchema: z.ZodObject<{
    normal: z.ZodLiteral<"eligible">;
    lognormal: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
    weibull: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
    gamma: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
    uniform: z.ZodLiteral<"eligible_with_boundary_warning">;
}, "strict", z.ZodTypeAny, {
    normal: "eligible";
    uniform: "eligible_with_boundary_warning";
    lognormal: "eligible" | "ineligible_nonpositive";
    weibull: "eligible" | "ineligible_nonpositive";
    gamma: "eligible" | "ineligible_nonpositive";
}, {
    normal: "eligible";
    uniform: "eligible_with_boundary_warning";
    lognormal: "eligible" | "ineligible_nonpositive";
    weibull: "eligible" | "ineligible_nonpositive";
    gamma: "eligible" | "ineligible_nonpositive";
}>;
export declare const f7DatasetValidationResultSchema: z.ZodObject<{
    status: z.ZodEnum<["ready", "blocked"]>;
    blockingIssues: z.ZodArray<z.ZodObject<{
        reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
        factorId: z.ZodOptional<z.ZodString>;
        rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
    }, "strict", z.ZodTypeAny, {
        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }, {
        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }>, "many">;
    advisoryIssues: z.ZodArray<z.ZodObject<{
        reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
        factorId: z.ZodOptional<z.ZodString>;
        rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
    }, "strict", z.ZodTypeAny, {
        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }, {
        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }>, "many">;
    candidateEligibility: z.ZodObject<{
        normal: z.ZodLiteral<"eligible">;
        lognormal: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
        weibull: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
        gamma: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
        uniform: z.ZodLiteral<"eligible_with_boundary_warning">;
    }, "strict", z.ZodTypeAny, {
        normal: "eligible";
        uniform: "eligible_with_boundary_warning";
        lognormal: "eligible" | "ineligible_nonpositive";
        weibull: "eligible" | "ineligible_nonpositive";
        gamma: "eligible" | "ineligible_nonpositive";
    }, {
        normal: "eligible";
        uniform: "eligible_with_boundary_warning";
        lognormal: "eligible" | "ineligible_nonpositive";
        weibull: "eligible" | "ineligible_nonpositive";
        gamma: "eligible" | "ineligible_nonpositive";
    }>;
}, "strict", z.ZodTypeAny, {
    status: "blocked" | "ready";
    blockingIssues: {
        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }[];
    advisoryIssues: {
        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }[];
    candidateEligibility: {
        normal: "eligible";
        uniform: "eligible_with_boundary_warning";
        lognormal: "eligible" | "ineligible_nonpositive";
        weibull: "eligible" | "ineligible_nonpositive";
        gamma: "eligible" | "ineligible_nonpositive";
    };
}, {
    status: "blocked" | "ready";
    blockingIssues: {
        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }[];
    advisoryIssues: {
        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }[];
    candidateEligibility: {
        normal: "eligible";
        uniform: "eligible_with_boundary_warning";
        lognormal: "eligible" | "ineligible_nonpositive";
        weibull: "eligible" | "ineligible_nonpositive";
        gamma: "eligible" | "ineligible_nonpositive";
    };
}>;
export declare const F7_DISTRIBUTION_CANDIDATE_ORDER: readonly ["normal", "lognormal", "weibull", "gamma", "uniform"];
export declare const f7DistributionCandidateFamilySchema: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
export declare const f7DistributionModelSpecificationSchema: z.ZodEnum<["normal_location_scale", "lognormal_location_zero", "lognormal_location_free", "weibull_location_zero", "weibull_location_free", "gamma_location_zero", "gamma_location_free", "uniform_boundary_mle"]>;
export type F7DistributionModelSpecification = z.infer<typeof f7DistributionModelSpecificationSchema>;
export declare function parameterCountForF7DistributionModelSpecification(specification: F7DistributionModelSpecification): number;
export declare const f7DistributionFitStatusSchema: z.ZodEnum<["acceptable", "weak", "rejected"]>;
export declare const f7DistributionFitParametersSchema: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodNumber>, Record<string, number>, Record<string, number>>;
export declare const F7_UNIFORM_BOUNDARY_WARNING = "Uniform MLE bounds equal the sample minimum and maximum; boundary estimates are sensitive to additional observations.";
export declare const f7DistributionFitQqPointSchema: z.ZodObject<{
    observed: z.ZodNumber;
    theoretical: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    observed: number;
    theoretical: number;
}, {
    observed: number;
    theoretical: number;
}>;
export declare const f7DistributionFitQqPointsSchema: z.ZodEffects<z.ZodArray<z.ZodObject<{
    observed: z.ZodNumber;
    theoretical: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    observed: number;
    theoretical: number;
}, {
    observed: number;
    theoretical: number;
}>, "many">, {
    observed: number;
    theoretical: number;
}[], {
    observed: number;
    theoretical: number;
}[]>;
export declare const f7DistributionFitBootstrapSchema: z.ZodEffects<z.ZodObject<{
    statisticId: z.ZodLiteral<"anderson_darling">;
    observedStatistic: z.ZodNumber;
    comparisonDirection: z.ZodLiteral<"greater_than_or_equal">;
    refitEachReplicate: z.ZodLiteral<true>;
    extremeReplicateCount: z.ZodNumber;
    confidenceInterval: z.ZodEffects<z.ZodObject<{
        level: z.ZodLiteral<0.95>;
        method: z.ZodLiteral<"wilson_score">;
        lower: z.ZodNumber;
        upper: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        method: "wilson_score";
        lower: number;
        upper: number;
        level: 0.95;
    }, {
        method: "wilson_score";
        lower: number;
        upper: number;
        level: 0.95;
    }>, {
        method: "wilson_score";
        lower: number;
        upper: number;
        level: 0.95;
    }, {
        method: "wilson_score";
        lower: number;
        upper: number;
        level: 0.95;
    }>;
    pValue: z.ZodNumber;
    replicates: z.ZodLiteral<10000>;
    seed: z.ZodString;
    methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
    candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
    streamDigest: z.ZodString;
    status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
}, "strict", z.ZodTypeAny, {
    status: "rejected" | "acceptable" | "weak";
    statisticId: "anderson_darling";
    observedStatistic: number;
    comparisonDirection: "greater_than_or_equal";
    refitEachReplicate: true;
    extremeReplicateCount: number;
    confidenceInterval: {
        method: "wilson_score";
        lower: number;
        upper: number;
        level: 0.95;
    };
    pValue: number;
    replicates: 10000;
    seed: string;
    methodId: "F7_BOOTSTRAP_V2";
    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
    streamDigest: string;
}, {
    status: "rejected" | "acceptable" | "weak";
    statisticId: "anderson_darling";
    observedStatistic: number;
    comparisonDirection: "greater_than_or_equal";
    refitEachReplicate: true;
    extremeReplicateCount: number;
    confidenceInterval: {
        method: "wilson_score";
        lower: number;
        upper: number;
        level: 0.95;
    };
    pValue: number;
    replicates: 10000;
    seed: string;
    methodId: "F7_BOOTSTRAP_V2";
    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
    streamDigest: string;
}>, {
    status: "rejected" | "acceptable" | "weak";
    statisticId: "anderson_darling";
    observedStatistic: number;
    comparisonDirection: "greater_than_or_equal";
    refitEachReplicate: true;
    extremeReplicateCount: number;
    confidenceInterval: {
        method: "wilson_score";
        lower: number;
        upper: number;
        level: 0.95;
    };
    pValue: number;
    replicates: 10000;
    seed: string;
    methodId: "F7_BOOTSTRAP_V2";
    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
    streamDigest: string;
}, {
    status: "rejected" | "acceptable" | "weak";
    statisticId: "anderson_darling";
    observedStatistic: number;
    comparisonDirection: "greater_than_or_equal";
    refitEachReplicate: true;
    extremeReplicateCount: number;
    confidenceInterval: {
        method: "wilson_score";
        lower: number;
        upper: number;
        level: 0.95;
    };
    pValue: number;
    replicates: 10000;
    seed: string;
    methodId: "F7_BOOTSTRAP_V2";
    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
    streamDigest: string;
}>;
export declare const f7DistributionFitCandidateSchema: z.ZodEffects<z.ZodObject<{
    family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
    modelSpecification: z.ZodEnum<["normal_location_scale", "lognormal_location_zero", "lognormal_location_free", "weibull_location_zero", "weibull_location_free", "gamma_location_zero", "gamma_location_free", "uniform_boundary_mle"]>;
    parameterCount: z.ZodNumber;
    parameters: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodNumber>, Record<string, number>, Record<string, number>>;
    logLikelihood: z.ZodNumber;
    aic: z.ZodNumber;
    aicc: z.ZodNumber;
    bic: z.ZodNumber;
    deltaAicc: z.ZodNumber;
    deltaBic: z.ZodNumber;
    ks: z.ZodNumber;
    ad: z.ZodNumber;
    qqPoints: z.ZodEffects<z.ZodArray<z.ZodObject<{
        observed: z.ZodNumber;
        theoretical: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        observed: number;
        theoretical: number;
    }, {
        observed: number;
        theoretical: number;
    }>, "many">, {
        observed: number;
        theoretical: number;
    }[], {
        observed: number;
        theoretical: number;
    }[]>;
    bootstrap: z.ZodEffects<z.ZodObject<{
        statisticId: z.ZodLiteral<"anderson_darling">;
        observedStatistic: z.ZodNumber;
        comparisonDirection: z.ZodLiteral<"greater_than_or_equal">;
        refitEachReplicate: z.ZodLiteral<true>;
        extremeReplicateCount: z.ZodNumber;
        confidenceInterval: z.ZodEffects<z.ZodObject<{
            level: z.ZodLiteral<0.95>;
            method: z.ZodLiteral<"wilson_score">;
            lower: z.ZodNumber;
            upper: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        }, {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        }>, {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        }, {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        }>;
        pValue: z.ZodNumber;
        replicates: z.ZodLiteral<10000>;
        seed: z.ZodString;
        methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
        candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
        streamDigest: z.ZodString;
        status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
    }, "strict", z.ZodTypeAny, {
        status: "rejected" | "acceptable" | "weak";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    }, {
        status: "rejected" | "acceptable" | "weak";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    }>, {
        status: "rejected" | "acceptable" | "weak";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    }, {
        status: "rejected" | "acceptable" | "weak";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    }>;
    warnings: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
    parameterCount: number;
    parameters: Record<string, number>;
    logLikelihood: number;
    aic: number;
    aicc: number;
    bic: number;
    deltaAicc: number;
    deltaBic: number;
    ks: number;
    ad: number;
    qqPoints: {
        observed: number;
        theoretical: number;
    }[];
    bootstrap: {
        status: "rejected" | "acceptable" | "weak";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    };
    warnings: string[];
}, {
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
    parameterCount: number;
    parameters: Record<string, number>;
    logLikelihood: number;
    aic: number;
    aicc: number;
    bic: number;
    deltaAicc: number;
    deltaBic: number;
    ks: number;
    ad: number;
    qqPoints: {
        observed: number;
        theoretical: number;
    }[];
    bootstrap: {
        status: "rejected" | "acceptable" | "weak";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    };
    warnings: string[];
}>, {
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
    parameterCount: number;
    parameters: Record<string, number>;
    logLikelihood: number;
    aic: number;
    aicc: number;
    bic: number;
    deltaAicc: number;
    deltaBic: number;
    ks: number;
    ad: number;
    qqPoints: {
        observed: number;
        theoretical: number;
    }[];
    bootstrap: {
        status: "rejected" | "acceptable" | "weak";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    };
    warnings: string[];
}, {
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
    parameterCount: number;
    parameters: Record<string, number>;
    logLikelihood: number;
    aic: number;
    aicc: number;
    bic: number;
    deltaAicc: number;
    deltaBic: number;
    ks: number;
    ad: number;
    qqPoints: {
        observed: number;
        theoretical: number;
    }[];
    bootstrap: {
        status: "rejected" | "acceptable" | "weak";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            method: "wilson_score";
            lower: number;
            upper: number;
            level: 0.95;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    };
    warnings: string[];
}>;
export declare const f7DistributionFitFailedCandidateSchema: z.ZodObject<{
    family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
    reasonCode: z.ZodLiteral<"numerical_fit_failed">;
}, "strict", z.ZodTypeAny, {
    reasonCode: "numerical_fit_failed";
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
}, {
    reasonCode: "numerical_fit_failed";
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
}>;
export declare const f7SampleDiagnosticsSchema: z.ZodObject<{
    mean: z.ZodNumber;
    median: z.ZodNumber;
    skewness: z.ZodNumber;
    coefficientOfVariation: z.ZodNumber;
    meanMedianRelativeDifference: z.ZodNumber;
    normalQqCurvature: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    mean: number;
    median: number;
    skewness: number;
    coefficientOfVariation: number;
    meanMedianRelativeDifference: number;
    normalQqCurvature: number;
}, {
    mean: number;
    median: number;
    skewness: number;
    coefficientOfVariation: number;
    meanMedianRelativeDifference: number;
    normalQqCurvature: number;
}>;
export declare const f7SelectionDecisionMethodIdSchema: z.ZodLiteral<"F7_MODEL_SELECTION_V1">;
export declare const f7SelectionDecisionStatusSchema: z.ZodEnum<["unique_preference", "no_unique_preference", "no_acceptable_model", "withheld_candidate_failures"]>;
export declare const f7SelectionDecisionConfidenceSchema: z.ZodEnum<["low", "moderate"]>;
export declare const f7SelectionDecisionReasonCodeSchema: z.ZodEnum<["SINGLE_ACCEPTABLE_COMPETITOR", "MULTIPLE_COMPETITIVE_MODELS", "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT", "SMALL_SAMPLE_UNCERTAINTY", "NO_ACCEPTABLE_MODEL", "CANDIDATE_FIT_FAILURES"]>;
export declare const f7SelectionDecisionSchema: z.ZodEffects<z.ZodObject<{
    methodId: z.ZodLiteral<"F7_MODEL_SELECTION_V1">;
    status: z.ZodEnum<["unique_preference", "no_unique_preference", "no_acceptable_model", "withheld_candidate_failures"]>;
    numericBestFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
    competitiveFamilies: z.ZodArray<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>, "many">;
    engineeringDefaultFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
    proposedFinalFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
    confidence: z.ZodEnum<["low", "moderate"]>;
    reasonCodes: z.ZodArray<z.ZodEnum<["SINGLE_ACCEPTABLE_COMPETITOR", "MULTIPLE_COMPETITIVE_MODELS", "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT", "SMALL_SAMPLE_UNCERTAINTY", "NO_ACCEPTABLE_MODEL", "CANDIDATE_FIT_FAILURES"]>, "many">;
}, "strict", z.ZodTypeAny, {
    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
    confidence: "low" | "moderate";
    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
    methodId: "F7_MODEL_SELECTION_V1";
    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
}, {
    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
    confidence: "low" | "moderate";
    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
    methodId: "F7_MODEL_SELECTION_V1";
    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
}>, {
    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
    confidence: "low" | "moderate";
    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
    methodId: "F7_MODEL_SELECTION_V1";
    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
}, {
    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
    confidence: "low" | "moderate";
    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
    methodId: "F7_MODEL_SELECTION_V1";
    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
}>;
export declare const f7DistributionCharacteristicKindSchema: z.ZodEnum<["dimensional", "other"]>;
export declare const f7DistributionFitResultSchema: z.ZodEffects<z.ZodObject<{
    factorId: z.ZodString;
    sampleSize: z.ZodNumber;
    characteristicKind: z.ZodEnum<["dimensional", "other"]>;
    candidates: z.ZodArray<z.ZodEffects<z.ZodObject<{
        family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
        modelSpecification: z.ZodEnum<["normal_location_scale", "lognormal_location_zero", "lognormal_location_free", "weibull_location_zero", "weibull_location_free", "gamma_location_zero", "gamma_location_free", "uniform_boundary_mle"]>;
        parameterCount: z.ZodNumber;
        parameters: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodNumber>, Record<string, number>, Record<string, number>>;
        logLikelihood: z.ZodNumber;
        aic: z.ZodNumber;
        aicc: z.ZodNumber;
        bic: z.ZodNumber;
        deltaAicc: z.ZodNumber;
        deltaBic: z.ZodNumber;
        ks: z.ZodNumber;
        ad: z.ZodNumber;
        qqPoints: z.ZodEffects<z.ZodArray<z.ZodObject<{
            observed: z.ZodNumber;
            theoretical: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            observed: number;
            theoretical: number;
        }, {
            observed: number;
            theoretical: number;
        }>, "many">, {
            observed: number;
            theoretical: number;
        }[], {
            observed: number;
            theoretical: number;
        }[]>;
        bootstrap: z.ZodEffects<z.ZodObject<{
            statisticId: z.ZodLiteral<"anderson_darling">;
            observedStatistic: z.ZodNumber;
            comparisonDirection: z.ZodLiteral<"greater_than_or_equal">;
            refitEachReplicate: z.ZodLiteral<true>;
            extremeReplicateCount: z.ZodNumber;
            confidenceInterval: z.ZodEffects<z.ZodObject<{
                level: z.ZodLiteral<0.95>;
                method: z.ZodLiteral<"wilson_score">;
                lower: z.ZodNumber;
                upper: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            }, {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            }>, {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            }, {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            }>;
            pValue: z.ZodNumber;
            replicates: z.ZodLiteral<10000>;
            seed: z.ZodString;
            methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
            candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
            streamDigest: z.ZodString;
            status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
        }, "strict", z.ZodTypeAny, {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        }, {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        }>, {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        }, {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        }>;
        warnings: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
        parameterCount: number;
        parameters: Record<string, number>;
        logLikelihood: number;
        aic: number;
        aicc: number;
        bic: number;
        deltaAicc: number;
        deltaBic: number;
        ks: number;
        ad: number;
        qqPoints: {
            observed: number;
            theoretical: number;
        }[];
        bootstrap: {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        };
        warnings: string[];
    }, {
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
        parameterCount: number;
        parameters: Record<string, number>;
        logLikelihood: number;
        aic: number;
        aicc: number;
        bic: number;
        deltaAicc: number;
        deltaBic: number;
        ks: number;
        ad: number;
        qqPoints: {
            observed: number;
            theoretical: number;
        }[];
        bootstrap: {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        };
        warnings: string[];
    }>, {
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
        parameterCount: number;
        parameters: Record<string, number>;
        logLikelihood: number;
        aic: number;
        aicc: number;
        bic: number;
        deltaAicc: number;
        deltaBic: number;
        ks: number;
        ad: number;
        qqPoints: {
            observed: number;
            theoretical: number;
        }[];
        bootstrap: {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        };
        warnings: string[];
    }, {
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
        parameterCount: number;
        parameters: Record<string, number>;
        logLikelihood: number;
        aic: number;
        aicc: number;
        bic: number;
        deltaAicc: number;
        deltaBic: number;
        ks: number;
        ad: number;
        qqPoints: {
            observed: number;
            theoretical: number;
        }[];
        bootstrap: {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        };
        warnings: string[];
    }>, "many">;
    failedCandidates: z.ZodArray<z.ZodObject<{
        family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
        reasonCode: z.ZodLiteral<"numerical_fit_failed">;
    }, "strict", z.ZodTypeAny, {
        reasonCode: "numerical_fit_failed";
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }, {
        reasonCode: "numerical_fit_failed";
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }>, "many">;
    sampleDiagnostics: z.ZodObject<{
        mean: z.ZodNumber;
        median: z.ZodNumber;
        skewness: z.ZodNumber;
        coefficientOfVariation: z.ZodNumber;
        meanMedianRelativeDifference: z.ZodNumber;
        normalQqCurvature: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        mean: number;
        median: number;
        skewness: number;
        coefficientOfVariation: number;
        meanMedianRelativeDifference: number;
        normalQqCurvature: number;
    }, {
        mean: number;
        median: number;
        skewness: number;
        coefficientOfVariation: number;
        meanMedianRelativeDifference: number;
        normalQqCurvature: number;
    }>;
    selectionDecision: z.ZodEffects<z.ZodObject<{
        methodId: z.ZodLiteral<"F7_MODEL_SELECTION_V1">;
        status: z.ZodEnum<["unique_preference", "no_unique_preference", "no_acceptable_model", "withheld_candidate_failures"]>;
        numericBestFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
        competitiveFamilies: z.ZodArray<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>, "many">;
        engineeringDefaultFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
        proposedFinalFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
        confidence: z.ZodEnum<["low", "moderate"]>;
        reasonCodes: z.ZodArray<z.ZodEnum<["SINGLE_ACCEPTABLE_COMPETITOR", "MULTIPLE_COMPETITIVE_MODELS", "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT", "SMALL_SAMPLE_UNCERTAINTY", "NO_ACCEPTABLE_MODEL", "CANDIDATE_FIT_FAILURES"]>, "many">;
    }, "strict", z.ZodTypeAny, {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
        numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    }, {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
        numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    }>, {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
        numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    }, {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
        numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    candidates: {
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
        parameterCount: number;
        parameters: Record<string, number>;
        logLikelihood: number;
        aic: number;
        aicc: number;
        bic: number;
        deltaAicc: number;
        deltaBic: number;
        ks: number;
        ad: number;
        qqPoints: {
            observed: number;
            theoretical: number;
        }[];
        bootstrap: {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        };
        warnings: string[];
    }[];
    factorId: string;
    sampleSize: number;
    characteristicKind: "other" | "dimensional";
    failedCandidates: {
        reasonCode: "numerical_fit_failed";
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }[];
    sampleDiagnostics: {
        mean: number;
        median: number;
        skewness: number;
        coefficientOfVariation: number;
        meanMedianRelativeDifference: number;
        normalQqCurvature: number;
    };
    selectionDecision: {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
        numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    };
}, {
    candidates: {
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
        parameterCount: number;
        parameters: Record<string, number>;
        logLikelihood: number;
        aic: number;
        aicc: number;
        bic: number;
        deltaAicc: number;
        deltaBic: number;
        ks: number;
        ad: number;
        qqPoints: {
            observed: number;
            theoretical: number;
        }[];
        bootstrap: {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        };
        warnings: string[];
    }[];
    factorId: string;
    sampleSize: number;
    characteristicKind: "other" | "dimensional";
    failedCandidates: {
        reasonCode: "numerical_fit_failed";
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }[];
    sampleDiagnostics: {
        mean: number;
        median: number;
        skewness: number;
        coefficientOfVariation: number;
        meanMedianRelativeDifference: number;
        normalQqCurvature: number;
    };
    selectionDecision: {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
        numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    };
}>, {
    candidates: {
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
        parameterCount: number;
        parameters: Record<string, number>;
        logLikelihood: number;
        aic: number;
        aicc: number;
        bic: number;
        deltaAicc: number;
        deltaBic: number;
        ks: number;
        ad: number;
        qqPoints: {
            observed: number;
            theoretical: number;
        }[];
        bootstrap: {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        };
        warnings: string[];
    }[];
    factorId: string;
    sampleSize: number;
    characteristicKind: "other" | "dimensional";
    failedCandidates: {
        reasonCode: "numerical_fit_failed";
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }[];
    sampleDiagnostics: {
        mean: number;
        median: number;
        skewness: number;
        coefficientOfVariation: number;
        meanMedianRelativeDifference: number;
        normalQqCurvature: number;
    };
    selectionDecision: {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
        numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    };
}, {
    candidates: {
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
        parameterCount: number;
        parameters: Record<string, number>;
        logLikelihood: number;
        aic: number;
        aicc: number;
        bic: number;
        deltaAicc: number;
        deltaBic: number;
        ks: number;
        ad: number;
        qqPoints: {
            observed: number;
            theoretical: number;
        }[];
        bootstrap: {
            status: "rejected" | "acceptable" | "weak";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                method: "wilson_score";
                lower: number;
                upper: number;
                level: 0.95;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        };
        warnings: string[];
    }[];
    factorId: string;
    sampleSize: number;
    characteristicKind: "other" | "dimensional";
    failedCandidates: {
        reasonCode: "numerical_fit_failed";
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }[];
    sampleDiagnostics: {
        mean: number;
        median: number;
        skewness: number;
        coefficientOfVariation: number;
        meanMedianRelativeDifference: number;
        normalQqCurvature: number;
    };
    selectionDecision: {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
        numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
        proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
    };
}>;
export declare const f7MeasurementPasteResultSchema: z.ZodObject<{
    status: z.ZodEnum<["ready", "blocked"]>;
    factorId: z.ZodString;
    dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        factorId: z.ZodString;
        unit: z.ZodString;
        structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
        rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
            subgroupSize: z.ZodNumber;
            estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
        }, "strict", z.ZodTypeAny, {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        }, {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        }>>;
        sourceReference: z.ZodString;
        importedAt: z.ZodString;
        msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
        observations: z.ZodArray<z.ZodDiscriminatedUnion<"disposition", [z.ZodObject<{
            disposition: z.ZodLiteral<"included">;
            value: z.ZodNumber;
            originalRow: z.ZodNumber;
            sequence: z.ZodOptional<z.ZodString>;
            timestamp: z.ZodOptional<z.ZodString>;
            subgroup: z.ZodOptional<z.ZodString>;
            batch: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }, {
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }>, z.ZodObject<{
            disposition: z.ZodLiteral<"excluded">;
            reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
            operatorReference: z.ZodString;
            confirmed: z.ZodLiteral<true>;
            value: z.ZodNumber;
            originalRow: z.ZodNumber;
            sequence: z.ZodOptional<z.ZodString>;
            timestamp: z.ZodOptional<z.ZodString>;
            subgroup: z.ZodOptional<z.ZodString>;
            batch: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }, {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }>]>, "many">;
        missingRowCount: z.ZodNumber;
        rejectionSummaries: z.ZodArray<z.ZodObject<{
            rowNumber: z.ZodNumber;
            reason: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
        }, "strict", z.ZodTypeAny, {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }, {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }>, "many">;
        originalRowCount: z.ZodNumber;
        analyzedCount: z.ZodNumber;
        contentHash: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }, {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }>, {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }, {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }>>;
    validation: z.ZodObject<{
        status: z.ZodEnum<["ready", "blocked"]>;
        blockingIssues: z.ZodArray<z.ZodObject<{
            reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
            factorId: z.ZodOptional<z.ZodString>;
            rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
        }, "strict", z.ZodTypeAny, {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }, {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }>, "many">;
        advisoryIssues: z.ZodArray<z.ZodObject<{
            reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
            factorId: z.ZodOptional<z.ZodString>;
            rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
        }, "strict", z.ZodTypeAny, {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }, {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }>, "many">;
        candidateEligibility: z.ZodObject<{
            normal: z.ZodLiteral<"eligible">;
            lognormal: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
            weibull: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
            gamma: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
            uniform: z.ZodLiteral<"eligible_with_boundary_warning">;
        }, "strict", z.ZodTypeAny, {
            normal: "eligible";
            uniform: "eligible_with_boundary_warning";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
        }, {
            normal: "eligible";
            uniform: "eligible_with_boundary_warning";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
        }>;
    }, "strict", z.ZodTypeAny, {
        status: "blocked" | "ready";
        blockingIssues: {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        advisoryIssues: {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        candidateEligibility: {
            normal: "eligible";
            uniform: "eligible_with_boundary_warning";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
        };
    }, {
        status: "blocked" | "ready";
        blockingIssues: {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        advisoryIssues: {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        candidateEligibility: {
            normal: "eligible";
            uniform: "eligible_with_boundary_warning";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
        };
    }>;
}, "strict", z.ZodTypeAny, {
    validation: {
        status: "blocked" | "ready";
        blockingIssues: {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        advisoryIssues: {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        candidateEligibility: {
            normal: "eligible";
            uniform: "eligible_with_boundary_warning";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
        };
    };
    status: "blocked" | "ready";
    factorId: string;
    dataset?: {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    } | undefined;
}, {
    validation: {
        status: "blocked" | "ready";
        blockingIssues: {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        advisoryIssues: {
            reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        candidateEligibility: {
            normal: "eligible";
            uniform: "eligible_with_boundary_warning";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
        };
    };
    status: "blocked" | "ready";
    factorId: string;
    dataset?: {
        unit: string;
        contentHash: string;
        observations: ({
            value: number;
            disposition: "included";
            originalRow: number;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        } | {
            value: number;
            confirmed: true;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            disposition: "excluded";
            originalRow: number;
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        factorId: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    } | undefined;
}>;
export declare const f7DistributionApprovalSchema: z.ZodObject<{
    factorId: z.ZodString;
    family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
    confirmed: z.ZodLiteral<true>;
    approvedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    confirmed: true;
    factorId: string;
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    approvedAt: string;
}, {
    confirmed: true;
    factorId: string;
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    approvedAt: string;
}>;
export declare const f7MonteCarloIterationsSchema: z.ZodUnion<[z.ZodLiteral<10000>, z.ZodLiteral<100000>]>;
export declare const f7CorrelationModeSchema: z.ZodLiteral<"INDEPENDENT">;
export declare const f7MonteCarloFactorManifestEntrySchema: z.ZodObject<{
    factorId: z.ZodString;
    family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
    sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
}, "strict", z.ZodTypeAny, {
    factorId: string;
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
}, {
    factorId: string;
    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
}>;
export declare const f7MonteCarloResultSchema: z.ZodEffects<z.ZodObject<{
    methodId: z.ZodLiteral<"F7_MONTE_CARLO_V1">;
    status: z.ZodLiteral<"complete">;
    lowerSpecLimit: z.ZodNumber;
    upperSpecLimit: z.ZodNumber;
    targetSigmaLevel: z.ZodNumber;
    iterations: z.ZodUnion<[z.ZodLiteral<10000>, z.ZodLiteral<100000>]>;
    runSeed: z.ZodString;
    correlationMode: z.ZodLiteral<"INDEPENDENT">;
    mean: z.ZodNumber;
    standardDeviation: z.ZodNumber;
    quantiles: z.ZodEffects<z.ZodObject<{
        p00135: z.ZodNumber;
        p01: z.ZodNumber;
        p05: z.ZodNumber;
        p50: z.ZodNumber;
        p95: z.ZodNumber;
        p99: z.ZodNumber;
        p99865: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        p00135: number;
        p01: number;
        p05: number;
        p50: number;
        p95: number;
        p99: number;
        p99865: number;
    }, {
        p00135: number;
        p01: number;
        p05: number;
        p50: number;
        p95: number;
        p99: number;
        p99865: number;
    }>, {
        p00135: number;
        p01: number;
        p05: number;
        p50: number;
        p95: number;
        p99: number;
        p99865: number;
    }, {
        p00135: number;
        p01: number;
        p05: number;
        p50: number;
        p95: number;
        p99: number;
        p99865: number;
    }>;
    inSpecCount: z.ZodNumber;
    outOfSpecCount: z.ZodNumber;
    yield: z.ZodNumber;
    outOfSpecProbability: z.ZodNumber;
    ppm: z.ZodNumber;
    histogram: z.ZodObject<{
        methodId: z.ZodLiteral<"F7_HISTOGRAM_FD_V1">;
        bins: z.ZodArray<z.ZodObject<{
            minimum: z.ZodNumber;
            maximum: z.ZodNumber;
            observedCount: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            minimum: number;
            maximum: number;
            observedCount: number;
        }, {
            minimum: number;
            maximum: number;
            observedCount: number;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        methodId: "F7_HISTOGRAM_FD_V1";
        bins: {
            minimum: number;
            maximum: number;
            observedCount: number;
        }[];
    }, {
        methodId: "F7_HISTOGRAM_FD_V1";
        bins: {
            minimum: number;
            maximum: number;
            observedCount: number;
        }[];
    }>;
    normalFit: z.ZodObject<{
        methodId: z.ZodLiteral<"F7_NORMAL_MOMENT_FIT_V1">;
        mean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        expectedBinCounts: z.ZodArray<z.ZodNumber, "many">;
    }, "strict", z.ZodTypeAny, {
        mean: number;
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        expectedBinCounts: number[];
    }, {
        mean: number;
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        expectedBinCounts: number[];
    }>;
    capability: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
        status: z.ZodLiteral<"available">;
        cp: z.ZodNumber;
        lowerCpk: z.ZodNumber;
        upperCpk: z.ZodNumber;
        cpk: z.ZodNumber;
        targetCpk: z.ZodNumber;
        targetStatus: z.ZodEnum<["meets_target", "below_target"]>;
    }, "strict", z.ZodTypeAny, {
        status: "available";
        cpk: number;
        targetCpk: number;
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        targetStatus: "meets_target" | "below_target";
    }, {
        status: "available";
        cpk: number;
        targetCpk: number;
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        targetStatus: "meets_target" | "below_target";
    }>, z.ZodObject<{
        status: z.ZodLiteral<"not_available">;
        reason: z.ZodLiteral<"zero_variance">;
        targetCpk: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        status: "not_available";
        targetCpk: number;
        reason: "zero_variance";
    }, {
        status: "not_available";
        targetCpk: number;
        reason: "zero_variance";
    }>]>;
    normalModel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
        status: z.ZodLiteral<"available">;
        lowerTailDpm: z.ZodNumber;
        upperTailDpm: z.ZodNumber;
        totalDpm: z.ZodNumber;
        expectedYield: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        status: "available";
        totalDpm: number;
        lowerTailDpm: number;
        upperTailDpm: number;
        expectedYield: number;
    }, {
        status: "available";
        totalDpm: number;
        lowerTailDpm: number;
        upperTailDpm: number;
        expectedYield: number;
    }>, z.ZodObject<{
        status: z.ZodLiteral<"not_available">;
        reason: z.ZodLiteral<"zero_variance">;
    }, "strict", z.ZodTypeAny, {
        status: "not_available";
        reason: "zero_variance";
    }, {
        status: "not_available";
        reason: "zero_variance";
    }>]>;
    factorManifest: z.ZodArray<z.ZodObject<{
        factorId: z.ZodString;
        family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
        sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
    }, "strict", z.ZodTypeAny, {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }, {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    status: "complete";
    capability: {
        status: "available";
        cpk: number;
        targetCpk: number;
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        targetStatus: "meets_target" | "below_target";
    } | {
        status: "not_available";
        targetCpk: number;
        reason: "zero_variance";
    };
    mean: number;
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    yield: number;
    methodId: "F7_MONTE_CARLO_V1";
    iterations: 10000 | 100000;
    runSeed: string;
    correlationMode: "INDEPENDENT";
    quantiles: {
        p00135: number;
        p01: number;
        p05: number;
        p50: number;
        p95: number;
        p99: number;
        p99865: number;
    };
    inSpecCount: number;
    outOfSpecCount: number;
    outOfSpecProbability: number;
    ppm: number;
    histogram: {
        methodId: "F7_HISTOGRAM_FD_V1";
        bins: {
            minimum: number;
            maximum: number;
            observedCount: number;
        }[];
    };
    normalFit: {
        mean: number;
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        expectedBinCounts: number[];
    };
    normalModel: {
        status: "available";
        totalDpm: number;
        lowerTailDpm: number;
        upperTailDpm: number;
        expectedYield: number;
    } | {
        status: "not_available";
        reason: "zero_variance";
    };
    factorManifest: {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
}, {
    status: "complete";
    capability: {
        status: "available";
        cpk: number;
        targetCpk: number;
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        targetStatus: "meets_target" | "below_target";
    } | {
        status: "not_available";
        targetCpk: number;
        reason: "zero_variance";
    };
    mean: number;
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    yield: number;
    methodId: "F7_MONTE_CARLO_V1";
    iterations: 10000 | 100000;
    runSeed: string;
    correlationMode: "INDEPENDENT";
    quantiles: {
        p00135: number;
        p01: number;
        p05: number;
        p50: number;
        p95: number;
        p99: number;
        p99865: number;
    };
    inSpecCount: number;
    outOfSpecCount: number;
    outOfSpecProbability: number;
    ppm: number;
    histogram: {
        methodId: "F7_HISTOGRAM_FD_V1";
        bins: {
            minimum: number;
            maximum: number;
            observedCount: number;
        }[];
    };
    normalFit: {
        mean: number;
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        expectedBinCounts: number[];
    };
    normalModel: {
        status: "available";
        totalDpm: number;
        lowerTailDpm: number;
        upperTailDpm: number;
        expectedYield: number;
    } | {
        status: "not_available";
        reason: "zero_variance";
    };
    factorManifest: {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
}>, {
    status: "complete";
    capability: {
        status: "available";
        cpk: number;
        targetCpk: number;
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        targetStatus: "meets_target" | "below_target";
    } | {
        status: "not_available";
        targetCpk: number;
        reason: "zero_variance";
    };
    mean: number;
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    yield: number;
    methodId: "F7_MONTE_CARLO_V1";
    iterations: 10000 | 100000;
    runSeed: string;
    correlationMode: "INDEPENDENT";
    quantiles: {
        p00135: number;
        p01: number;
        p05: number;
        p50: number;
        p95: number;
        p99: number;
        p99865: number;
    };
    inSpecCount: number;
    outOfSpecCount: number;
    outOfSpecProbability: number;
    ppm: number;
    histogram: {
        methodId: "F7_HISTOGRAM_FD_V1";
        bins: {
            minimum: number;
            maximum: number;
            observedCount: number;
        }[];
    };
    normalFit: {
        mean: number;
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        expectedBinCounts: number[];
    };
    normalModel: {
        status: "available";
        totalDpm: number;
        lowerTailDpm: number;
        upperTailDpm: number;
        expectedYield: number;
    } | {
        status: "not_available";
        reason: "zero_variance";
    };
    factorManifest: {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
}, {
    status: "complete";
    capability: {
        status: "available";
        cpk: number;
        targetCpk: number;
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        targetStatus: "meets_target" | "below_target";
    } | {
        status: "not_available";
        targetCpk: number;
        reason: "zero_variance";
    };
    mean: number;
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    yield: number;
    methodId: "F7_MONTE_CARLO_V1";
    iterations: 10000 | 100000;
    runSeed: string;
    correlationMode: "INDEPENDENT";
    quantiles: {
        p00135: number;
        p01: number;
        p05: number;
        p50: number;
        p95: number;
        p99: number;
        p99865: number;
    };
    inSpecCount: number;
    outOfSpecCount: number;
    outOfSpecProbability: number;
    ppm: number;
    histogram: {
        methodId: "F7_HISTOGRAM_FD_V1";
        bins: {
            minimum: number;
            maximum: number;
            observedCount: number;
        }[];
    };
    normalFit: {
        mean: number;
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        expectedBinCounts: number[];
    };
    normalModel: {
        status: "available";
        totalDpm: number;
        lowerTailDpm: number;
        upperTailDpm: number;
        expectedYield: number;
    } | {
        status: "not_available";
        reason: "zero_variance";
    };
    factorManifest: {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
}>;
export declare const f7ReportAssessmentSchema: z.ZodEnum<["MEETS_TARGET", "BELOW_TARGET", "NOT_EVALUABLE"]>;
export declare const f7ReportWorkbookSchema: z.ZodObject<{
    fileName: z.ZodString;
    workbookContentHash: z.ZodString;
    worksheetName: z.ZodString;
}, "strict", z.ZodTypeAny, {
    fileName: string;
    worksheetName: string;
    workbookContentHash: string;
}, {
    fileName: string;
    worksheetName: string;
    workbookContentHash: string;
}>;
export declare const f7ReportSummarySchema: z.ZodEffects<z.ZodObject<{
    mean: z.ZodNumber;
    standardDeviation: z.ZodNumber;
    yield: z.ZodNumber;
    ppm: z.ZodNumber;
    lowerSpecLimit: z.ZodNumber;
    upperSpecLimit: z.ZodNumber;
    targetSigmaLevel: z.ZodNumber;
    cp: z.ZodOptional<z.ZodNumber>;
    cpk: z.ZodOptional<z.ZodNumber>;
    targetCpk: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    mean: number;
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    targetCpk: number;
    yield: number;
    ppm: number;
    cpk?: number | undefined;
    cp?: number | undefined;
}, {
    mean: number;
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    targetCpk: number;
    yield: number;
    ppm: number;
    cpk?: number | undefined;
    cp?: number | undefined;
}>, {
    mean: number;
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    targetCpk: number;
    yield: number;
    ppm: number;
    cpk?: number | undefined;
    cp?: number | undefined;
}, {
    mean: number;
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    targetCpk: number;
    yield: number;
    ppm: number;
    cpk?: number | undefined;
    cp?: number | undefined;
}>;
export declare const f7ReportFactorSchema: z.ZodObject<{
    factorId: z.ZodString;
    factorName: z.ZodString;
    loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<0>, z.ZodLiteral<1>]>;
    sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
    approvedDistribution: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
    sourceReferences: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    factorName: string;
    sourceReferences: string[];
    factorId: string;
    loopCoefficient: 0 | 1 | -1;
    sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    approvedDistribution: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
}, {
    factorName: string;
    sourceReferences: string[];
    factorId: string;
    loopCoefficient: 0 | 1 | -1;
    sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    approvedDistribution: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
}>;
export declare const f7ReportSpecificationSourceCellsSchema: z.ZodObject<{
    lowerSpecLimit: z.ZodOptional<z.ZodString>;
    upperSpecLimit: z.ZodOptional<z.ZodString>;
    targetSigmaLevel: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    lowerSpecLimit?: string | undefined;
    upperSpecLimit?: string | undefined;
    targetSigmaLevel?: string | undefined;
}, {
    lowerSpecLimit?: string | undefined;
    upperSpecLimit?: string | undefined;
    targetSigmaLevel?: string | undefined;
}>;
export declare const f7ReportSpecificationInputOriginsSchema: z.ZodObject<{
    lowerSpecLimit: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
    upperSpecLimit: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
    targetSigmaLevel: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
}, "strict", z.ZodTypeAny, {
    lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
    upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
    targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
}, {
    lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
    upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
    targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
}>;
export declare const f7ReportMethodIdsSchema: z.ZodObject<{
    simulation: z.ZodLiteral<"F7_MONTE_CARLO_V1">;
    histogram: z.ZodLiteral<"F7_HISTOGRAM_FD_V1">;
    normalFit: z.ZodLiteral<"F7_NORMAL_MOMENT_FIT_V1">;
}, "strict", z.ZodTypeAny, {
    histogram: "F7_HISTOGRAM_FD_V1";
    normalFit: "F7_NORMAL_MOMENT_FIT_V1";
    simulation: "F7_MONTE_CARLO_V1";
}, {
    histogram: "F7_HISTOGRAM_FD_V1";
    normalFit: "F7_NORMAL_MOMENT_FIT_V1";
    simulation: "F7_MONTE_CARLO_V1";
}>;
export declare const f7ReportEvidenceSchema: z.ZodEffects<z.ZodObject<{
    workbookContentHash: z.ZodString;
    worksheetName: z.ZodString;
    specificationSourceCells: z.ZodObject<{
        lowerSpecLimit: z.ZodOptional<z.ZodString>;
        upperSpecLimit: z.ZodOptional<z.ZodString>;
        targetSigmaLevel: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        lowerSpecLimit?: string | undefined;
        upperSpecLimit?: string | undefined;
        targetSigmaLevel?: string | undefined;
    }, {
        lowerSpecLimit?: string | undefined;
        upperSpecLimit?: string | undefined;
        targetSigmaLevel?: string | undefined;
    }>;
    specificationInputOrigins: z.ZodObject<{
        lowerSpecLimit: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
        upperSpecLimit: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
        targetSigmaLevel: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
    }, "strict", z.ZodTypeAny, {
        lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
    }, {
        lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
    }>;
    methodIds: z.ZodObject<{
        simulation: z.ZodLiteral<"F7_MONTE_CARLO_V1">;
        histogram: z.ZodLiteral<"F7_HISTOGRAM_FD_V1">;
        normalFit: z.ZodLiteral<"F7_NORMAL_MOMENT_FIT_V1">;
    }, "strict", z.ZodTypeAny, {
        histogram: "F7_HISTOGRAM_FD_V1";
        normalFit: "F7_NORMAL_MOMENT_FIT_V1";
        simulation: "F7_MONTE_CARLO_V1";
    }, {
        histogram: "F7_HISTOGRAM_FD_V1";
        normalFit: "F7_NORMAL_MOMENT_FIT_V1";
        simulation: "F7_MONTE_CARLO_V1";
    }>;
    seed: z.ZodString;
    iterations: z.ZodUnion<[z.ZodLiteral<10000>, z.ZodLiteral<100000>]>;
    factorManifest: z.ZodArray<z.ZodObject<{
        factorId: z.ZodString;
        family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
        sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
    }, "strict", z.ZodTypeAny, {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }, {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    worksheetName: string;
    workbookContentHash: string;
    seed: string;
    iterations: 10000 | 100000;
    factorManifest: {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
    specificationSourceCells: {
        lowerSpecLimit?: string | undefined;
        upperSpecLimit?: string | undefined;
        targetSigmaLevel?: string | undefined;
    };
    specificationInputOrigins: {
        lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
    };
    methodIds: {
        histogram: "F7_HISTOGRAM_FD_V1";
        normalFit: "F7_NORMAL_MOMENT_FIT_V1";
        simulation: "F7_MONTE_CARLO_V1";
    };
}, {
    worksheetName: string;
    workbookContentHash: string;
    seed: string;
    iterations: 10000 | 100000;
    factorManifest: {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
    specificationSourceCells: {
        lowerSpecLimit?: string | undefined;
        upperSpecLimit?: string | undefined;
        targetSigmaLevel?: string | undefined;
    };
    specificationInputOrigins: {
        lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
    };
    methodIds: {
        histogram: "F7_HISTOGRAM_FD_V1";
        normalFit: "F7_NORMAL_MOMENT_FIT_V1";
        simulation: "F7_MONTE_CARLO_V1";
    };
}>, {
    worksheetName: string;
    workbookContentHash: string;
    seed: string;
    iterations: 10000 | 100000;
    factorManifest: {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
    specificationSourceCells: {
        lowerSpecLimit?: string | undefined;
        upperSpecLimit?: string | undefined;
        targetSigmaLevel?: string | undefined;
    };
    specificationInputOrigins: {
        lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
    };
    methodIds: {
        histogram: "F7_HISTOGRAM_FD_V1";
        normalFit: "F7_NORMAL_MOMENT_FIT_V1";
        simulation: "F7_MONTE_CARLO_V1";
    };
}, {
    worksheetName: string;
    workbookContentHash: string;
    seed: string;
    iterations: 10000 | 100000;
    factorManifest: {
        factorId: string;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
    specificationSourceCells: {
        lowerSpecLimit?: string | undefined;
        upperSpecLimit?: string | undefined;
        targetSigmaLevel?: string | undefined;
    };
    specificationInputOrigins: {
        lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
        targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
    };
    methodIds: {
        histogram: "F7_HISTOGRAM_FD_V1";
        normalFit: "F7_NORMAL_MOMENT_FIT_V1";
        simulation: "F7_MONTE_CARLO_V1";
    };
}>;
export declare const f7ReportAnalysisSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"available">;
    provenance: z.ZodUnion<[z.ZodObject<{
        knowledgeBaseVersion: z.ZodLiteral<"v1">;
        ruleId: z.ZodLiteral<"default-cpk-target">;
        threshold: z.ZodNumber;
        applicability: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        ruleId: "default-cpk-target";
        threshold: number;
        applicability: string;
        knowledgeBaseVersion: "v1";
    }, {
        ruleId: "default-cpk-target";
        threshold: number;
        applicability: string;
        knowledgeBaseVersion: "v1";
    }>, z.ZodObject<{
        knowledgeBaseVersion: z.ZodLiteral<"interpretation-rules-v2">;
        ruleId: z.ZodEnum<["performance-cpk", "performance-cpk-below-target"]>;
        threshold: z.ZodNumber;
        applicability: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        ruleId: "performance-cpk" | "performance-cpk-below-target";
        threshold: number;
        applicability: string;
        knowledgeBaseVersion: "interpretation-rules-v2";
    }, {
        ruleId: "performance-cpk" | "performance-cpk-below-target";
        threshold: number;
        applicability: string;
        knowledgeBaseVersion: "interpretation-rules-v2";
    }>]>;
    comparison: z.ZodObject<{
        setup: z.ZodObject<{
            mean: z.ZodNumber;
            standardDeviation: z.ZodNumber;
            cp: z.ZodNumber;
            cpk: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        }, {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        }>;
        monteCarlo: z.ZodObject<{
            mean: z.ZodNumber;
            standardDeviation: z.ZodNumber;
            cp: z.ZodNumber;
            cpk: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        }, {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        }>;
    }, "strict", z.ZodTypeAny, {
        setup: {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        };
        monteCarlo: {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        };
    }, {
        setup: {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        };
        monteCarlo: {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        };
    }>;
    targetAssessment: z.ZodString;
    interpretations: z.ZodArray<z.ZodString, "many">;
    optimizationDirections: z.ZodArray<z.ZodString, "many">;
    rootCauseSignals: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        title: z.ZodString;
        sourceAlias: z.ZodString;
        sourceFileHash: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        ruleId: string;
        sourceAlias: string;
        sourceFileHash: string;
        title: string;
    }, {
        ruleId: string;
        sourceAlias: string;
        sourceFileHash: string;
        title: string;
    }>, "many">;
    controlledOptions: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        title: z.ZodString;
        sourceAlias: z.ZodString;
        sourceFileHash: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        ruleId: string;
        sourceAlias: string;
        sourceFileHash: string;
        title: string;
    }, {
        ruleId: string;
        sourceAlias: string;
        sourceFileHash: string;
        title: string;
    }>, "many">;
    validationRequirements: z.ZodArray<z.ZodString, "many">;
    narrative: z.ZodObject<{
        resultJudgment: z.ZodObject<{
            status: z.ZodEnum<["meets-target", "below-target"]>;
            headline: z.ZodString;
            judgment: z.ZodString;
            cpk: z.ZodNumber;
            targetCpk: z.ZodNumber;
            margin: z.ZodNumber;
            display: z.ZodObject<{
                cpk: z.ZodString;
                targetCpk: z.ZodString;
                margin: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                cpk: string;
                targetCpk: string;
                margin: string;
            }, {
                cpk: string;
                targetCpk: string;
                margin: string;
            }>;
            nearerSpecificationSide: z.ZodOptional<z.ZodEnum<["LSL", "USL", "balanced"]>>;
        }, "strict", z.ZodTypeAny, {
            status: "meets-target" | "below-target";
            cpk: number;
            targetCpk: number;
            headline: string;
            judgment: string;
            margin: number;
            display: {
                cpk: string;
                targetCpk: string;
                margin: string;
            };
            nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
        }, {
            status: "meets-target" | "below-target";
            cpk: number;
            targetCpk: number;
            headline: string;
            judgment: string;
            margin: number;
            display: {
                cpk: string;
                targetCpk: string;
                margin: string;
            };
            nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
        }>;
        engineeringSummary: z.ZodString;
        rootCauseAnalysis: z.ZodArray<z.ZodEffects<z.ZodObject<{
            ruleId: z.ZodString;
            title: z.ZodString;
            sourceAlias: z.ZodOptional<z.ZodString>;
            sourceFileHash: z.ZodOptional<z.ZodString>;
            hypothesis: z.ZodLiteral<true>;
            explanation: z.ZodString;
            completeEvidence: z.ZodBoolean;
            quantitativeEvidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
            quantitativeEvidenceLabels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            ruleId: string;
            title: string;
            hypothesis: true;
            explanation: string;
            completeEvidence: boolean;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
            quantitativeEvidence?: Record<string, string | number> | undefined;
            quantitativeEvidenceLabels?: Record<string, string> | undefined;
        }, {
            ruleId: string;
            title: string;
            hypothesis: true;
            explanation: string;
            completeEvidence: boolean;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
            quantitativeEvidence?: Record<string, string | number> | undefined;
            quantitativeEvidenceLabels?: Record<string, string> | undefined;
        }>, {
            ruleId: string;
            title: string;
            hypothesis: true;
            explanation: string;
            completeEvidence: boolean;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
            quantitativeEvidence?: Record<string, string | number> | undefined;
            quantitativeEvidenceLabels?: Record<string, string> | undefined;
        }, {
            ruleId: string;
            title: string;
            hypothesis: true;
            explanation: string;
            completeEvidence: boolean;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
            quantitativeEvidence?: Record<string, string | number> | undefined;
            quantitativeEvidenceLabels?: Record<string, string> | undefined;
        }>, "many">;
        engineeringRisk: z.ZodString;
        suggestedActionSequence: z.ZodArray<z.ZodObject<{
            optionId: z.ZodString;
            title: z.ZodString;
            sourceAlias: z.ZodOptional<z.ZodString>;
            sourceFileHash: z.ZodOptional<z.ZodString>;
            narrative: z.ZodString;
            validationSteps: z.ZodArray<z.ZodString, "many">;
        }, "strict", z.ZodTypeAny, {
            title: string;
            validationSteps: string[];
            optionId: string;
            narrative: string;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
        }, {
            title: string;
            validationSteps: string[];
            optionId: string;
            narrative: string;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
        }>, "many">;
        validationRequirements: z.ZodArray<z.ZodString, "many">;
        evidenceDisclosure: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        resultJudgment: {
            status: "meets-target" | "below-target";
            cpk: number;
            targetCpk: number;
            headline: string;
            judgment: string;
            margin: number;
            display: {
                cpk: string;
                targetCpk: string;
                margin: string;
            };
            nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
        };
        engineeringSummary: string;
        rootCauseAnalysis: {
            ruleId: string;
            title: string;
            hypothesis: true;
            explanation: string;
            completeEvidence: boolean;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
            quantitativeEvidence?: Record<string, string | number> | undefined;
            quantitativeEvidenceLabels?: Record<string, string> | undefined;
        }[];
        engineeringRisk: string;
        suggestedActionSequence: {
            title: string;
            validationSteps: string[];
            optionId: string;
            narrative: string;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
        }[];
        validationRequirements: string[];
        evidenceDisclosure: string;
    }, {
        resultJudgment: {
            status: "meets-target" | "below-target";
            cpk: number;
            targetCpk: number;
            headline: string;
            judgment: string;
            margin: number;
            display: {
                cpk: string;
                targetCpk: string;
                margin: string;
            };
            nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
        };
        engineeringSummary: string;
        rootCauseAnalysis: {
            ruleId: string;
            title: string;
            hypothesis: true;
            explanation: string;
            completeEvidence: boolean;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
            quantitativeEvidence?: Record<string, string | number> | undefined;
            quantitativeEvidenceLabels?: Record<string, string> | undefined;
        }[];
        engineeringRisk: string;
        suggestedActionSequence: {
            title: string;
            validationSteps: string[];
            optionId: string;
            narrative: string;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
        }[];
        validationRequirements: string[];
        evidenceDisclosure: string;
    }>;
}, "strict", z.ZodTypeAny, {
    status: "available";
    provenance: {
        ruleId: "default-cpk-target";
        threshold: number;
        applicability: string;
        knowledgeBaseVersion: "v1";
    } | {
        ruleId: "performance-cpk" | "performance-cpk-below-target";
        threshold: number;
        applicability: string;
        knowledgeBaseVersion: "interpretation-rules-v2";
    };
    comparison: {
        setup: {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        };
        monteCarlo: {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        };
    };
    narrative: {
        resultJudgment: {
            status: "meets-target" | "below-target";
            cpk: number;
            targetCpk: number;
            headline: string;
            judgment: string;
            margin: number;
            display: {
                cpk: string;
                targetCpk: string;
                margin: string;
            };
            nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
        };
        engineeringSummary: string;
        rootCauseAnalysis: {
            ruleId: string;
            title: string;
            hypothesis: true;
            explanation: string;
            completeEvidence: boolean;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
            quantitativeEvidence?: Record<string, string | number> | undefined;
            quantitativeEvidenceLabels?: Record<string, string> | undefined;
        }[];
        engineeringRisk: string;
        suggestedActionSequence: {
            title: string;
            validationSteps: string[];
            optionId: string;
            narrative: string;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
        }[];
        validationRequirements: string[];
        evidenceDisclosure: string;
    };
    validationRequirements: string[];
    targetAssessment: string;
    interpretations: string[];
    optimizationDirections: string[];
    rootCauseSignals: {
        ruleId: string;
        sourceAlias: string;
        sourceFileHash: string;
        title: string;
    }[];
    controlledOptions: {
        ruleId: string;
        sourceAlias: string;
        sourceFileHash: string;
        title: string;
    }[];
}, {
    status: "available";
    provenance: {
        ruleId: "default-cpk-target";
        threshold: number;
        applicability: string;
        knowledgeBaseVersion: "v1";
    } | {
        ruleId: "performance-cpk" | "performance-cpk-below-target";
        threshold: number;
        applicability: string;
        knowledgeBaseVersion: "interpretation-rules-v2";
    };
    comparison: {
        setup: {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        };
        monteCarlo: {
            cpk: number;
            mean: number;
            standardDeviation: number;
            cp: number;
        };
    };
    narrative: {
        resultJudgment: {
            status: "meets-target" | "below-target";
            cpk: number;
            targetCpk: number;
            headline: string;
            judgment: string;
            margin: number;
            display: {
                cpk: string;
                targetCpk: string;
                margin: string;
            };
            nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
        };
        engineeringSummary: string;
        rootCauseAnalysis: {
            ruleId: string;
            title: string;
            hypothesis: true;
            explanation: string;
            completeEvidence: boolean;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
            quantitativeEvidence?: Record<string, string | number> | undefined;
            quantitativeEvidenceLabels?: Record<string, string> | undefined;
        }[];
        engineeringRisk: string;
        suggestedActionSequence: {
            title: string;
            validationSteps: string[];
            optionId: string;
            narrative: string;
            sourceAlias?: string | undefined;
            sourceFileHash?: string | undefined;
        }[];
        validationRequirements: string[];
        evidenceDisclosure: string;
    };
    validationRequirements: string[];
    targetAssessment: string;
    interpretations: string[];
    optimizationDirections: string[];
    rootCauseSignals: {
        ruleId: string;
        sourceAlias: string;
        sourceFileHash: string;
        title: string;
    }[];
    controlledOptions: {
        ruleId: string;
        sourceAlias: string;
        sourceFileHash: string;
        title: string;
    }[];
}>, z.ZodObject<{
    status: z.ZodLiteral<"unavailable">;
    reason: z.ZodString;
    optimizationDirections: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    status: "unavailable";
    reason: string;
    optimizationDirections: string[];
}, {
    status: "unavailable";
    reason: string;
    optimizationDirections: string[];
}>]>;
export declare const f7ReportProjectionSchema: z.ZodEffects<z.ZodObject<{
    contractId: z.ZodLiteral<"f7-report-v1">;
    outputClassification: z.ZodLiteral<"confidential">;
    sessionId: z.ZodString;
    generatedAt: z.ZodString;
    assessment: z.ZodEnum<["MEETS_TARGET", "BELOW_TARGET", "NOT_EVALUABLE"]>;
    workbook: z.ZodObject<{
        fileName: z.ZodString;
        workbookContentHash: z.ZodString;
        worksheetName: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        fileName: string;
        worksheetName: string;
        workbookContentHash: string;
    }, {
        fileName: string;
        worksheetName: string;
        workbookContentHash: string;
    }>;
    summary: z.ZodEffects<z.ZodObject<{
        mean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        yield: z.ZodNumber;
        ppm: z.ZodNumber;
        lowerSpecLimit: z.ZodNumber;
        upperSpecLimit: z.ZodNumber;
        targetSigmaLevel: z.ZodNumber;
        cp: z.ZodOptional<z.ZodNumber>;
        cpk: z.ZodOptional<z.ZodNumber>;
        targetCpk: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        targetCpk: number;
        yield: number;
        ppm: number;
        cpk?: number | undefined;
        cp?: number | undefined;
    }, {
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        targetCpk: number;
        yield: number;
        ppm: number;
        cpk?: number | undefined;
        cp?: number | undefined;
    }>, {
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        targetCpk: number;
        yield: number;
        ppm: number;
        cpk?: number | undefined;
        cp?: number | undefined;
    }, {
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        targetCpk: number;
        yield: number;
        ppm: number;
        cpk?: number | undefined;
        cp?: number | undefined;
    }>;
    simulation: z.ZodEffects<z.ZodObject<{
        methodId: z.ZodLiteral<"F7_MONTE_CARLO_V1">;
        status: z.ZodLiteral<"complete">;
        lowerSpecLimit: z.ZodNumber;
        upperSpecLimit: z.ZodNumber;
        targetSigmaLevel: z.ZodNumber;
        iterations: z.ZodUnion<[z.ZodLiteral<10000>, z.ZodLiteral<100000>]>;
        runSeed: z.ZodString;
        correlationMode: z.ZodLiteral<"INDEPENDENT">;
        mean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        quantiles: z.ZodEffects<z.ZodObject<{
            p00135: z.ZodNumber;
            p01: z.ZodNumber;
            p05: z.ZodNumber;
            p50: z.ZodNumber;
            p95: z.ZodNumber;
            p99: z.ZodNumber;
            p99865: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        }, {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        }>, {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        }, {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        }>;
        inSpecCount: z.ZodNumber;
        outOfSpecCount: z.ZodNumber;
        yield: z.ZodNumber;
        outOfSpecProbability: z.ZodNumber;
        ppm: z.ZodNumber;
        histogram: z.ZodObject<{
            methodId: z.ZodLiteral<"F7_HISTOGRAM_FD_V1">;
            bins: z.ZodArray<z.ZodObject<{
                minimum: z.ZodNumber;
                maximum: z.ZodNumber;
                observedCount: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                minimum: number;
                maximum: number;
                observedCount: number;
            }, {
                minimum: number;
                maximum: number;
                observedCount: number;
            }>, "many">;
        }, "strict", z.ZodTypeAny, {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        }, {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        }>;
        normalFit: z.ZodObject<{
            methodId: z.ZodLiteral<"F7_NORMAL_MOMENT_FIT_V1">;
            mean: z.ZodNumber;
            standardDeviation: z.ZodNumber;
            expectedBinCounts: z.ZodArray<z.ZodNumber, "many">;
        }, "strict", z.ZodTypeAny, {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        }, {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        }>;
        capability: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            cp: z.ZodNumber;
            lowerCpk: z.ZodNumber;
            upperCpk: z.ZodNumber;
            cpk: z.ZodNumber;
            targetCpk: z.ZodNumber;
            targetStatus: z.ZodEnum<["meets_target", "below_target"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        }, {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        }>, z.ZodObject<{
            status: z.ZodLiteral<"not_available">;
            reason: z.ZodLiteral<"zero_variance">;
            targetCpk: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        }, {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        }>]>;
        normalModel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            lowerTailDpm: z.ZodNumber;
            upperTailDpm: z.ZodNumber;
            totalDpm: z.ZodNumber;
            expectedYield: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        }, {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"not_available">;
            reason: z.ZodLiteral<"zero_variance">;
        }, "strict", z.ZodTypeAny, {
            status: "not_available";
            reason: "zero_variance";
        }, {
            status: "not_available";
            reason: "zero_variance";
        }>]>;
        factorManifest: z.ZodArray<z.ZodObject<{
            factorId: z.ZodString;
            family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
            sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
        }, "strict", z.ZodTypeAny, {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }, {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }, {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }>, {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }, {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }>;
    factors: z.ZodArray<z.ZodObject<{
        factorId: z.ZodString;
        factorName: z.ZodString;
        loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<0>, z.ZodLiteral<1>]>;
        sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
        approvedDistribution: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
        sourceReferences: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        factorName: string;
        sourceReferences: string[];
        factorId: string;
        loopCoefficient: 0 | 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }, {
        factorName: string;
        sourceReferences: string[];
        factorId: string;
        loopCoefficient: 0 | 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }>, "many">;
    analysis: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
        status: z.ZodLiteral<"available">;
        provenance: z.ZodUnion<[z.ZodObject<{
            knowledgeBaseVersion: z.ZodLiteral<"v1">;
            ruleId: z.ZodLiteral<"default-cpk-target">;
            threshold: z.ZodNumber;
            applicability: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            ruleId: "default-cpk-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "v1";
        }, {
            ruleId: "default-cpk-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "v1";
        }>, z.ZodObject<{
            knowledgeBaseVersion: z.ZodLiteral<"interpretation-rules-v2">;
            ruleId: z.ZodEnum<["performance-cpk", "performance-cpk-below-target"]>;
            threshold: z.ZodNumber;
            applicability: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            ruleId: "performance-cpk" | "performance-cpk-below-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "interpretation-rules-v2";
        }, {
            ruleId: "performance-cpk" | "performance-cpk-below-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "interpretation-rules-v2";
        }>]>;
        comparison: z.ZodObject<{
            setup: z.ZodObject<{
                mean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                cp: z.ZodNumber;
                cpk: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            }, {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            }>;
            monteCarlo: z.ZodObject<{
                mean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                cp: z.ZodNumber;
                cpk: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            }, {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            }>;
        }, "strict", z.ZodTypeAny, {
            setup: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
            monteCarlo: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
        }, {
            setup: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
            monteCarlo: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
        }>;
        targetAssessment: z.ZodString;
        interpretations: z.ZodArray<z.ZodString, "many">;
        optimizationDirections: z.ZodArray<z.ZodString, "many">;
        rootCauseSignals: z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            title: z.ZodString;
            sourceAlias: z.ZodString;
            sourceFileHash: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }, {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }>, "many">;
        controlledOptions: z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            title: z.ZodString;
            sourceAlias: z.ZodString;
            sourceFileHash: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }, {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }>, "many">;
        validationRequirements: z.ZodArray<z.ZodString, "many">;
        narrative: z.ZodObject<{
            resultJudgment: z.ZodObject<{
                status: z.ZodEnum<["meets-target", "below-target"]>;
                headline: z.ZodString;
                judgment: z.ZodString;
                cpk: z.ZodNumber;
                targetCpk: z.ZodNumber;
                margin: z.ZodNumber;
                display: z.ZodObject<{
                    cpk: z.ZodString;
                    targetCpk: z.ZodString;
                    margin: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                }, {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                }>;
                nearerSpecificationSide: z.ZodOptional<z.ZodEnum<["LSL", "USL", "balanced"]>>;
            }, "strict", z.ZodTypeAny, {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            }, {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            }>;
            engineeringSummary: z.ZodString;
            rootCauseAnalysis: z.ZodArray<z.ZodEffects<z.ZodObject<{
                ruleId: z.ZodString;
                title: z.ZodString;
                sourceAlias: z.ZodOptional<z.ZodString>;
                sourceFileHash: z.ZodOptional<z.ZodString>;
                hypothesis: z.ZodLiteral<true>;
                explanation: z.ZodString;
                completeEvidence: z.ZodBoolean;
                quantitativeEvidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
                quantitativeEvidenceLabels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            }, "strict", z.ZodTypeAny, {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }, {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }>, {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }, {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }>, "many">;
            engineeringRisk: z.ZodString;
            suggestedActionSequence: z.ZodArray<z.ZodObject<{
                optionId: z.ZodString;
                title: z.ZodString;
                sourceAlias: z.ZodOptional<z.ZodString>;
                sourceFileHash: z.ZodOptional<z.ZodString>;
                narrative: z.ZodString;
                validationSteps: z.ZodArray<z.ZodString, "many">;
            }, "strict", z.ZodTypeAny, {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }, {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }>, "many">;
            validationRequirements: z.ZodArray<z.ZodString, "many">;
            evidenceDisclosure: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            resultJudgment: {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            };
            engineeringSummary: string;
            rootCauseAnalysis: {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }[];
            engineeringRisk: string;
            suggestedActionSequence: {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }[];
            validationRequirements: string[];
            evidenceDisclosure: string;
        }, {
            resultJudgment: {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            };
            engineeringSummary: string;
            rootCauseAnalysis: {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }[];
            engineeringRisk: string;
            suggestedActionSequence: {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }[];
            validationRequirements: string[];
            evidenceDisclosure: string;
        }>;
    }, "strict", z.ZodTypeAny, {
        status: "available";
        provenance: {
            ruleId: "default-cpk-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "v1";
        } | {
            ruleId: "performance-cpk" | "performance-cpk-below-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "interpretation-rules-v2";
        };
        comparison: {
            setup: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
            monteCarlo: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
        };
        narrative: {
            resultJudgment: {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            };
            engineeringSummary: string;
            rootCauseAnalysis: {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }[];
            engineeringRisk: string;
            suggestedActionSequence: {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }[];
            validationRequirements: string[];
            evidenceDisclosure: string;
        };
        validationRequirements: string[];
        targetAssessment: string;
        interpretations: string[];
        optimizationDirections: string[];
        rootCauseSignals: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
        controlledOptions: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
    }, {
        status: "available";
        provenance: {
            ruleId: "default-cpk-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "v1";
        } | {
            ruleId: "performance-cpk" | "performance-cpk-below-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "interpretation-rules-v2";
        };
        comparison: {
            setup: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
            monteCarlo: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
        };
        narrative: {
            resultJudgment: {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            };
            engineeringSummary: string;
            rootCauseAnalysis: {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }[];
            engineeringRisk: string;
            suggestedActionSequence: {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }[];
            validationRequirements: string[];
            evidenceDisclosure: string;
        };
        validationRequirements: string[];
        targetAssessment: string;
        interpretations: string[];
        optimizationDirections: string[];
        rootCauseSignals: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
        controlledOptions: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
    }>, z.ZodObject<{
        status: z.ZodLiteral<"unavailable">;
        reason: z.ZodString;
        optimizationDirections: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        status: "unavailable";
        reason: string;
        optimizationDirections: string[];
    }, {
        status: "unavailable";
        reason: string;
        optimizationDirections: string[];
    }>]>>;
    evidence: z.ZodEffects<z.ZodObject<{
        workbookContentHash: z.ZodString;
        worksheetName: z.ZodString;
        specificationSourceCells: z.ZodObject<{
            lowerSpecLimit: z.ZodOptional<z.ZodString>;
            upperSpecLimit: z.ZodOptional<z.ZodString>;
            targetSigmaLevel: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        }, {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        }>;
        specificationInputOrigins: z.ZodObject<{
            lowerSpecLimit: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
            upperSpecLimit: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
            targetSigmaLevel: z.ZodEnum<["excel_source", "manual_override", "manual_entry"]>;
        }, "strict", z.ZodTypeAny, {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        }, {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        }>;
        methodIds: z.ZodObject<{
            simulation: z.ZodLiteral<"F7_MONTE_CARLO_V1">;
            histogram: z.ZodLiteral<"F7_HISTOGRAM_FD_V1">;
            normalFit: z.ZodLiteral<"F7_NORMAL_MOMENT_FIT_V1">;
        }, "strict", z.ZodTypeAny, {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        }, {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        }>;
        seed: z.ZodString;
        iterations: z.ZodUnion<[z.ZodLiteral<10000>, z.ZodLiteral<100000>]>;
        factorManifest: z.ZodArray<z.ZodObject<{
            factorId: z.ZodString;
            family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
            sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
        }, "strict", z.ZodTypeAny, {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }, {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        worksheetName: string;
        workbookContentHash: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
        specificationSourceCells: {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        };
        specificationInputOrigins: {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        };
        methodIds: {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        };
    }, {
        worksheetName: string;
        workbookContentHash: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
        specificationSourceCells: {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        };
        specificationInputOrigins: {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        };
        methodIds: {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        };
    }>, {
        worksheetName: string;
        workbookContentHash: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
        specificationSourceCells: {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        };
        specificationInputOrigins: {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        };
        methodIds: {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        };
    }, {
        worksheetName: string;
        workbookContentHash: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
        specificationSourceCells: {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        };
        specificationInputOrigins: {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        };
        methodIds: {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        };
    }>;
    markdown: z.ZodString;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
    outputClassification: "confidential";
    contractId: "f7-report-v1";
    summary: {
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        targetCpk: number;
        yield: number;
        ppm: number;
        cpk?: number | undefined;
        cp?: number | undefined;
    };
    workbook: {
        fileName: string;
        worksheetName: string;
        workbookContentHash: string;
    };
    factors: {
        factorName: string;
        sourceReferences: string[];
        factorId: string;
        loopCoefficient: 0 | 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }[];
    evidence: {
        worksheetName: string;
        workbookContentHash: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
        specificationSourceCells: {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        };
        specificationInputOrigins: {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        };
        methodIds: {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        };
    };
    generatedAt: string;
    simulation: {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    };
    assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
    markdown: string;
    analysis?: {
        status: "available";
        provenance: {
            ruleId: "default-cpk-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "v1";
        } | {
            ruleId: "performance-cpk" | "performance-cpk-below-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "interpretation-rules-v2";
        };
        comparison: {
            setup: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
            monteCarlo: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
        };
        narrative: {
            resultJudgment: {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            };
            engineeringSummary: string;
            rootCauseAnalysis: {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }[];
            engineeringRisk: string;
            suggestedActionSequence: {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }[];
            validationRequirements: string[];
            evidenceDisclosure: string;
        };
        validationRequirements: string[];
        targetAssessment: string;
        interpretations: string[];
        optimizationDirections: string[];
        rootCauseSignals: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
        controlledOptions: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
    } | {
        status: "unavailable";
        reason: string;
        optimizationDirections: string[];
    } | undefined;
}, {
    sessionId: string;
    outputClassification: "confidential";
    contractId: "f7-report-v1";
    summary: {
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        targetCpk: number;
        yield: number;
        ppm: number;
        cpk?: number | undefined;
        cp?: number | undefined;
    };
    workbook: {
        fileName: string;
        worksheetName: string;
        workbookContentHash: string;
    };
    factors: {
        factorName: string;
        sourceReferences: string[];
        factorId: string;
        loopCoefficient: 0 | 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }[];
    evidence: {
        worksheetName: string;
        workbookContentHash: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
        specificationSourceCells: {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        };
        specificationInputOrigins: {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        };
        methodIds: {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        };
    };
    generatedAt: string;
    simulation: {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    };
    assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
    markdown: string;
    analysis?: {
        status: "available";
        provenance: {
            ruleId: "default-cpk-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "v1";
        } | {
            ruleId: "performance-cpk" | "performance-cpk-below-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "interpretation-rules-v2";
        };
        comparison: {
            setup: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
            monteCarlo: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
        };
        narrative: {
            resultJudgment: {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            };
            engineeringSummary: string;
            rootCauseAnalysis: {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }[];
            engineeringRisk: string;
            suggestedActionSequence: {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }[];
            validationRequirements: string[];
            evidenceDisclosure: string;
        };
        validationRequirements: string[];
        targetAssessment: string;
        interpretations: string[];
        optimizationDirections: string[];
        rootCauseSignals: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
        controlledOptions: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
    } | {
        status: "unavailable";
        reason: string;
        optimizationDirections: string[];
    } | undefined;
}>, {
    sessionId: string;
    outputClassification: "confidential";
    contractId: "f7-report-v1";
    summary: {
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        targetCpk: number;
        yield: number;
        ppm: number;
        cpk?: number | undefined;
        cp?: number | undefined;
    };
    workbook: {
        fileName: string;
        worksheetName: string;
        workbookContentHash: string;
    };
    factors: {
        factorName: string;
        sourceReferences: string[];
        factorId: string;
        loopCoefficient: 0 | 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }[];
    evidence: {
        worksheetName: string;
        workbookContentHash: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
        specificationSourceCells: {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        };
        specificationInputOrigins: {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        };
        methodIds: {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        };
    };
    generatedAt: string;
    simulation: {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    };
    assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
    markdown: string;
    analysis?: {
        status: "available";
        provenance: {
            ruleId: "default-cpk-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "v1";
        } | {
            ruleId: "performance-cpk" | "performance-cpk-below-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "interpretation-rules-v2";
        };
        comparison: {
            setup: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
            monteCarlo: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
        };
        narrative: {
            resultJudgment: {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            };
            engineeringSummary: string;
            rootCauseAnalysis: {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }[];
            engineeringRisk: string;
            suggestedActionSequence: {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }[];
            validationRequirements: string[];
            evidenceDisclosure: string;
        };
        validationRequirements: string[];
        targetAssessment: string;
        interpretations: string[];
        optimizationDirections: string[];
        rootCauseSignals: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
        controlledOptions: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
    } | {
        status: "unavailable";
        reason: string;
        optimizationDirections: string[];
    } | undefined;
}, {
    sessionId: string;
    outputClassification: "confidential";
    contractId: "f7-report-v1";
    summary: {
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        targetCpk: number;
        yield: number;
        ppm: number;
        cpk?: number | undefined;
        cp?: number | undefined;
    };
    workbook: {
        fileName: string;
        worksheetName: string;
        workbookContentHash: string;
    };
    factors: {
        factorName: string;
        sourceReferences: string[];
        factorId: string;
        loopCoefficient: 0 | 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }[];
    evidence: {
        worksheetName: string;
        workbookContentHash: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
        specificationSourceCells: {
            lowerSpecLimit?: string | undefined;
            upperSpecLimit?: string | undefined;
            targetSigmaLevel?: string | undefined;
        };
        specificationInputOrigins: {
            lowerSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            upperSpecLimit: "excel_source" | "manual_override" | "manual_entry";
            targetSigmaLevel: "excel_source" | "manual_override" | "manual_entry";
        };
        methodIds: {
            histogram: "F7_HISTOGRAM_FD_V1";
            normalFit: "F7_NORMAL_MOMENT_FIT_V1";
            simulation: "F7_MONTE_CARLO_V1";
        };
    };
    generatedAt: string;
    simulation: {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    };
    assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
    markdown: string;
    analysis?: {
        status: "available";
        provenance: {
            ruleId: "default-cpk-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "v1";
        } | {
            ruleId: "performance-cpk" | "performance-cpk-below-target";
            threshold: number;
            applicability: string;
            knowledgeBaseVersion: "interpretation-rules-v2";
        };
        comparison: {
            setup: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
            monteCarlo: {
                cpk: number;
                mean: number;
                standardDeviation: number;
                cp: number;
            };
        };
        narrative: {
            resultJudgment: {
                status: "meets-target" | "below-target";
                cpk: number;
                targetCpk: number;
                headline: string;
                judgment: string;
                margin: number;
                display: {
                    cpk: string;
                    targetCpk: string;
                    margin: string;
                };
                nearerSpecificationSide?: "LSL" | "USL" | "balanced" | undefined;
            };
            engineeringSummary: string;
            rootCauseAnalysis: {
                ruleId: string;
                title: string;
                hypothesis: true;
                explanation: string;
                completeEvidence: boolean;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
                quantitativeEvidence?: Record<string, string | number> | undefined;
                quantitativeEvidenceLabels?: Record<string, string> | undefined;
            }[];
            engineeringRisk: string;
            suggestedActionSequence: {
                title: string;
                validationSteps: string[];
                optionId: string;
                narrative: string;
                sourceAlias?: string | undefined;
                sourceFileHash?: string | undefined;
            }[];
            validationRequirements: string[];
            evidenceDisclosure: string;
        };
        validationRequirements: string[];
        targetAssessment: string;
        interpretations: string[];
        optimizationDirections: string[];
        rootCauseSignals: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
        controlledOptions: {
            ruleId: string;
            sourceAlias: string;
            sourceFileHash: string;
            title: string;
        }[];
    } | {
        status: "unavailable";
        reason: string;
        optimizationDirections: string[];
    } | undefined;
}>;
export declare const f7AnalysisRequestContractIdSchema: z.ZodLiteral<"f7-analysis-request-v1">;
export declare const f7AnalysisResultContractIdSchema: z.ZodLiteral<"f7-analysis-result-v1">;
export declare const f7SessionStatusSchema: z.ZodEnum<["worksheet_selection", "factor_setup", "measurement_entry", "phase_1_ready"]>;
export declare const f7WorksheetOptionSchema: z.ZodObject<{
    selectionIndex: z.ZodNumber;
    worksheetName: z.ZodString;
    toleranceLoopDescription: z.ZodString;
    worksheetKind: z.ZodEnum<["analysis", "example_or_template"]>;
    source: z.ZodUnion<[z.ZodObject<{
        summarySheet: z.ZodLiteral<"Auto Summary">;
        summaryRow: z.ZodNumber;
        worksheetAnchor: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        summarySheet: "Auto Summary";
        summaryRow: number;
        worksheetAnchor: string;
    }, {
        summarySheet: "Auto Summary";
        summaryRow: number;
        worksheetAnchor: string;
    }>, z.ZodObject<{
        discoveryMethod: z.ZodLiteral<"worksheet_scan">;
        descriptionCell: z.ZodString;
        worksheetAnchor: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        worksheetAnchor: string;
        discoveryMethod: "worksheet_scan";
        descriptionCell: string;
    }, {
        worksheetAnchor: string;
        discoveryMethod: "worksheet_scan";
        descriptionCell: string;
    }>]>;
}, "strict", z.ZodTypeAny, {
    source: {
        summarySheet: "Auto Summary";
        summaryRow: number;
        worksheetAnchor: string;
    } | {
        worksheetAnchor: string;
        discoveryMethod: "worksheet_scan";
        descriptionCell: string;
    };
    worksheetName: string;
    toleranceLoopDescription: string;
    worksheetKind: "analysis" | "example_or_template";
    selectionIndex: number;
}, {
    source: {
        summarySheet: "Auto Summary";
        summaryRow: number;
        worksheetAnchor: string;
    } | {
        worksheetAnchor: string;
        discoveryMethod: "worksheet_scan";
        descriptionCell: string;
    };
    worksheetName: string;
    toleranceLoopDescription: string;
    worksheetKind: "analysis" | "example_or_template";
    selectionIndex: number;
}>;
export declare const f7SessionSnapshotSchema: z.ZodEffects<z.ZodObject<{
    contractId: z.ZodLiteral<"f7-analysis-result-v1">;
    outputClassification: z.ZodLiteral<"confidential">;
    sessionId: z.ZodString;
    status: z.ZodEnum<["worksheet_selection", "factor_setup", "measurement_entry", "phase_1_ready"]>;
    workbook: z.ZodObject<{
        fileName: z.ZodString;
        workbookContentHash: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        fileName: string;
        workbookContentHash: string;
    }, {
        fileName: string;
        workbookContentHash: string;
    }>;
    selectedWorksheetNames: z.ZodArray<z.ZodString, "many">;
    worksheetOptions: z.ZodArray<z.ZodObject<{
        selectionIndex: z.ZodNumber;
        worksheetName: z.ZodString;
        toleranceLoopDescription: z.ZodString;
        worksheetKind: z.ZodEnum<["analysis", "example_or_template"]>;
        source: z.ZodUnion<[z.ZodObject<{
            summarySheet: z.ZodLiteral<"Auto Summary">;
            summaryRow: z.ZodNumber;
            worksheetAnchor: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        }, {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        }>, z.ZodObject<{
            discoveryMethod: z.ZodLiteral<"worksheet_scan">;
            descriptionCell: z.ZodString;
            worksheetAnchor: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        }, {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        }>]>;
    }, "strict", z.ZodTypeAny, {
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
        worksheetName: string;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        selectionIndex: number;
    }, {
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
        worksheetName: string;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        selectionIndex: number;
    }>, "many">;
    dimensionChainImage: z.ZodOptional<z.ZodObject<{
        status: z.ZodLiteral<"available">;
        worksheetName: z.ZodString;
        contentHash: z.ZodString;
        url: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        status: "available";
        contentHash: string;
        worksheetName: string;
        url: string;
    }, {
        status: "available";
        contentHash: string;
        worksheetName: string;
        url: string;
    }>>;
    systemSpecification: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
        designNominal: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>;
        lowerSpecLimit: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>;
        upperSpecLimit: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>;
        targetSigmaLevel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>;
        additionalMeanShift: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>;
        volume: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>>;
        status: z.ZodLiteral<"available">;
    }, "strict", z.ZodTypeAny, {
        status: "available";
        designNominal: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        lowerSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        upperSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        targetSigmaLevel: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        additionalMeanShift: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    }, {
        status: "available";
        designNominal: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        lowerSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        upperSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        targetSigmaLevel: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        additionalMeanShift: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    }>, z.ZodObject<{
        status: z.ZodLiteral<"unavailable">;
        reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "system_specification_range_invalid", "legacy_artifact_missing_system_specification"]>;
        designNominal: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>>;
        lowerSpecLimit: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>>;
        upperSpecLimit: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>>;
        targetSigmaLevel: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>>;
        additionalMeanShift: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>>;
        volume: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            actualValue: z.ZodNumber;
            displayValue: z.ZodString;
            sourceLabel: z.ZodString;
            sourceCell: z.ZodOptional<z.ZodString>;
            valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }, {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
            sourceCell: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        }>]>>;
    }, "strict", z.ZodTypeAny, {
        status: "unavailable";
        reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
        designNominal?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        lowerSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        upperSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        targetSigmaLevel?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        additionalMeanShift?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    }, {
        status: "unavailable";
        reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
        designNominal?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        lowerSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        upperSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        targetSigmaLevel?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        additionalMeanShift?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    }>]>>;
    factors: z.ZodArray<z.ZodEffects<z.ZodObject<{
        factorCandidate: z.ZodEffects<z.ZodObject<{
            longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
            sigmaLevel: z.ZodOptional<z.ZodNumber>;
            standardDeviation: z.ZodNumber;
            distribution: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
            lowerSpecLimit: z.ZodNumber;
            upperSpecLimit: z.ZodNumber;
            designNominal: z.ZodNumber;
            upperTolerance: z.ZodNumber;
            lowerTolerance: z.ZodNumber;
            workbookContentHash: z.ZodString;
            worksheetName: z.ZodString;
            tableId: z.ZodString;
            sourceRow: z.ZodNumber;
            sourceCells: z.ZodRecord<z.ZodString, z.ZodString>;
            factorCandidateId: z.ZodString;
            factorName: z.ZodString;
            userAdded: z.ZodOptional<z.ZodLiteral<true>>;
            workbookUnitEvidence: z.ZodOptional<z.ZodString>;
            excelSignedMean: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        }, {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        }>, {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        }, {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        }>;
        setup: z.ZodOptional<z.ZodEffects<z.ZodObject<{
            longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
            sigmaLevel: z.ZodOptional<z.ZodNumber>;
            distribution: z.ZodOptional<z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>>;
            confirmed: z.ZodLiteral<true>;
            designNominal: z.ZodNumber;
            upperTolerance: z.ZodNumber;
            lowerTolerance: z.ZodNumber;
            factorCandidateId: z.ZodString;
            factorName: z.ZodOptional<z.ZodString>;
            userAdded: z.ZodOptional<z.ZodLiteral<true>>;
        }, "strict", z.ZodTypeAny, {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        }, {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        }>, {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        }, {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        }>>;
        sourceMode: z.ZodOptional<z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>>;
        input: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
            mode: z.ZodLiteral<"MEASURED">;
            dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                factorId: z.ZodString;
                unit: z.ZodString;
                structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
                rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
                    subgroupSize: z.ZodNumber;
                    estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
                }, "strict", z.ZodTypeAny, {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                }, {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                }>>;
                sourceReference: z.ZodString;
                importedAt: z.ZodString;
                msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
                observations: z.ZodArray<z.ZodDiscriminatedUnion<"disposition", [z.ZodObject<{
                    disposition: z.ZodLiteral<"included">;
                    value: z.ZodNumber;
                    originalRow: z.ZodNumber;
                    sequence: z.ZodOptional<z.ZodString>;
                    timestamp: z.ZodOptional<z.ZodString>;
                    subgroup: z.ZodOptional<z.ZodString>;
                    batch: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }, {
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }>, z.ZodObject<{
                    disposition: z.ZodLiteral<"excluded">;
                    reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
                    operatorReference: z.ZodString;
                    confirmed: z.ZodLiteral<true>;
                    value: z.ZodNumber;
                    originalRow: z.ZodNumber;
                    sequence: z.ZodOptional<z.ZodString>;
                    timestamp: z.ZodOptional<z.ZodString>;
                    subgroup: z.ZodOptional<z.ZodString>;
                    batch: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }, {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }>]>, "many">;
                missingRowCount: z.ZodNumber;
                rejectionSummaries: z.ZodArray<z.ZodObject<{
                    rowNumber: z.ZodNumber;
                    reason: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
                }, "strict", z.ZodTypeAny, {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }, {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }>, "many">;
                originalRowCount: z.ZodNumber;
                analyzedCount: z.ZodNumber;
                contentHash: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            }, {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            }>, {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            }, {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            }>>;
        }, "strict", z.ZodTypeAny, {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        }, {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        }>, z.ZodObject<{
            mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
            baselineSampler: z.ZodEffects<z.ZodDiscriminatedUnion<"samplerId", [z.ZodObject<{
                samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
                physicalMean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                support: z.ZodLiteral<"REAL">;
            }, "strict", z.ZodTypeAny, {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            }, {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            }>, z.ZodObject<{
                samplerId: z.ZodLiteral<"UNIFORM_BOUNDED_V1">;
                physicalMean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                minimum: z.ZodNumber;
                maximum: z.ZodNumber;
                support: z.ZodLiteral<"BOUNDED_REAL">;
            }, "strict", z.ZodTypeAny, {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            }, {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            }>]>, {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            }, {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            }>;
        }, "strict", z.ZodTypeAny, {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        }, {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        }>]>>;
        evidence: z.ZodOptional<z.ZodEffects<z.ZodObject<{
            loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<0>, z.ZodLiteral<1>]>;
            physicalMean: z.ZodNumber;
            signedContributionMean: z.ZodNumber;
            baselineSampler: z.ZodEffects<z.ZodDiscriminatedUnion<"samplerId", [z.ZodObject<{
                samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
                physicalMean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                support: z.ZodLiteral<"REAL">;
            }, "strict", z.ZodTypeAny, {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            }, {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            }>, z.ZodObject<{
                samplerId: z.ZodLiteral<"UNIFORM_BOUNDED_V1">;
                physicalMean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                minimum: z.ZodNumber;
                maximum: z.ZodNumber;
                support: z.ZodLiteral<"BOUNDED_REAL">;
            }, "strict", z.ZodTypeAny, {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            }, {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            }>]>, {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            }, {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            }>;
            lowerSpecLimit: z.ZodNumber;
            upperSpecLimit: z.ZodNumber;
            calculatedMean: z.ZodNumber;
            tolerance: z.ZodNumber;
            oneSigma: z.ZodNumber;
            percentContributionToSigma: z.ZodNumber;
            longTermSafetyFactor: z.ZodNumber;
            sigmaLevel: z.ZodNumber;
            distribution: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
            designNominal: z.ZodNumber;
            upperTolerance: z.ZodNumber;
            lowerTolerance: z.ZodNumber;
            workbookContentHash: z.ZodString;
            worksheetName: z.ZodString;
            tableId: z.ZodString;
            sourceRow: z.ZodNumber;
            sourceCells: z.ZodRecord<z.ZodString, z.ZodString>;
            factorCandidateId: z.ZodString;
            factorId: z.ZodString;
            factorName: z.ZodString;
            userAdded: z.ZodOptional<z.ZodLiteral<true>>;
            unit: z.ZodString;
            unitSource: z.ZodEnum<["workbook", "user_confirmed", "unspecified"]>;
        }, "strict", z.ZodTypeAny, {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        }, {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        }>, {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        }, {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        }>>;
        datasetValidation: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<["ready", "blocked"]>;
            blockingIssues: z.ZodArray<z.ZodObject<{
                reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                factorId: z.ZodOptional<z.ZodString>;
                rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
            }, "strict", z.ZodTypeAny, {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }, {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }>, "many">;
            advisoryIssues: z.ZodArray<z.ZodObject<{
                reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                factorId: z.ZodOptional<z.ZodString>;
                rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
            }, "strict", z.ZodTypeAny, {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }, {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }>, "many">;
            candidateEligibility: z.ZodObject<{
                normal: z.ZodLiteral<"eligible">;
                lognormal: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                weibull: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                gamma: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                uniform: z.ZodLiteral<"eligible_with_boundary_warning">;
            }, "strict", z.ZodTypeAny, {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            }, {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            }>;
        }, "strict", z.ZodTypeAny, {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        }, {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        }>>;
        measurementPasteResult: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<["ready", "blocked"]>;
            factorId: z.ZodString;
            dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                factorId: z.ZodString;
                unit: z.ZodString;
                structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
                rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
                    subgroupSize: z.ZodNumber;
                    estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
                }, "strict", z.ZodTypeAny, {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                }, {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                }>>;
                sourceReference: z.ZodString;
                importedAt: z.ZodString;
                msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
                observations: z.ZodArray<z.ZodDiscriminatedUnion<"disposition", [z.ZodObject<{
                    disposition: z.ZodLiteral<"included">;
                    value: z.ZodNumber;
                    originalRow: z.ZodNumber;
                    sequence: z.ZodOptional<z.ZodString>;
                    timestamp: z.ZodOptional<z.ZodString>;
                    subgroup: z.ZodOptional<z.ZodString>;
                    batch: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }, {
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }>, z.ZodObject<{
                    disposition: z.ZodLiteral<"excluded">;
                    reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
                    operatorReference: z.ZodString;
                    confirmed: z.ZodLiteral<true>;
                    value: z.ZodNumber;
                    originalRow: z.ZodNumber;
                    sequence: z.ZodOptional<z.ZodString>;
                    timestamp: z.ZodOptional<z.ZodString>;
                    subgroup: z.ZodOptional<z.ZodString>;
                    batch: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }, {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }>]>, "many">;
                missingRowCount: z.ZodNumber;
                rejectionSummaries: z.ZodArray<z.ZodObject<{
                    rowNumber: z.ZodNumber;
                    reason: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
                }, "strict", z.ZodTypeAny, {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }, {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }>, "many">;
                originalRowCount: z.ZodNumber;
                analyzedCount: z.ZodNumber;
                contentHash: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            }, {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            }>, {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            }, {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            }>>;
            validation: z.ZodObject<{
                status: z.ZodEnum<["ready", "blocked"]>;
                blockingIssues: z.ZodArray<z.ZodObject<{
                    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                    factorId: z.ZodOptional<z.ZodString>;
                    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                }, "strict", z.ZodTypeAny, {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }, {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }>, "many">;
                advisoryIssues: z.ZodArray<z.ZodObject<{
                    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                    factorId: z.ZodOptional<z.ZodString>;
                    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                }, "strict", z.ZodTypeAny, {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }, {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }>, "many">;
                candidateEligibility: z.ZodObject<{
                    normal: z.ZodLiteral<"eligible">;
                    lognormal: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                    weibull: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                    gamma: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                    uniform: z.ZodLiteral<"eligible_with_boundary_warning">;
                }, "strict", z.ZodTypeAny, {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                }, {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                }>;
            }, "strict", z.ZodTypeAny, {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            }, {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            }>;
        }, "strict", z.ZodTypeAny, {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        }, {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        }>>;
        distributionFitResult: z.ZodOptional<z.ZodEffects<z.ZodObject<{
            factorId: z.ZodString;
            sampleSize: z.ZodNumber;
            characteristicKind: z.ZodEnum<["dimensional", "other"]>;
            candidates: z.ZodArray<z.ZodEffects<z.ZodObject<{
                family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
                modelSpecification: z.ZodEnum<["normal_location_scale", "lognormal_location_zero", "lognormal_location_free", "weibull_location_zero", "weibull_location_free", "gamma_location_zero", "gamma_location_free", "uniform_boundary_mle"]>;
                parameterCount: z.ZodNumber;
                parameters: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodNumber>, Record<string, number>, Record<string, number>>;
                logLikelihood: z.ZodNumber;
                aic: z.ZodNumber;
                aicc: z.ZodNumber;
                bic: z.ZodNumber;
                deltaAicc: z.ZodNumber;
                deltaBic: z.ZodNumber;
                ks: z.ZodNumber;
                ad: z.ZodNumber;
                qqPoints: z.ZodEffects<z.ZodArray<z.ZodObject<{
                    observed: z.ZodNumber;
                    theoretical: z.ZodNumber;
                }, "strict", z.ZodTypeAny, {
                    observed: number;
                    theoretical: number;
                }, {
                    observed: number;
                    theoretical: number;
                }>, "many">, {
                    observed: number;
                    theoretical: number;
                }[], {
                    observed: number;
                    theoretical: number;
                }[]>;
                bootstrap: z.ZodEffects<z.ZodObject<{
                    statisticId: z.ZodLiteral<"anderson_darling">;
                    observedStatistic: z.ZodNumber;
                    comparisonDirection: z.ZodLiteral<"greater_than_or_equal">;
                    refitEachReplicate: z.ZodLiteral<true>;
                    extremeReplicateCount: z.ZodNumber;
                    confidenceInterval: z.ZodEffects<z.ZodObject<{
                        level: z.ZodLiteral<0.95>;
                        method: z.ZodLiteral<"wilson_score">;
                        lower: z.ZodNumber;
                        upper: z.ZodNumber;
                    }, "strict", z.ZodTypeAny, {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    }, {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    }>, {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    }, {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    }>;
                    pValue: z.ZodNumber;
                    replicates: z.ZodLiteral<10000>;
                    seed: z.ZodString;
                    methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
                    candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
                    streamDigest: z.ZodString;
                    status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
                }, "strict", z.ZodTypeAny, {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                }, {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                }>, {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                }, {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                }>;
                warnings: z.ZodArray<z.ZodString, "many">;
            }, "strict", z.ZodTypeAny, {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }, {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }>, {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }, {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }>, "many">;
            failedCandidates: z.ZodArray<z.ZodObject<{
                family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
                reasonCode: z.ZodLiteral<"numerical_fit_failed">;
            }, "strict", z.ZodTypeAny, {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }, {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }>, "many">;
            sampleDiagnostics: z.ZodObject<{
                mean: z.ZodNumber;
                median: z.ZodNumber;
                skewness: z.ZodNumber;
                coefficientOfVariation: z.ZodNumber;
                meanMedianRelativeDifference: z.ZodNumber;
                normalQqCurvature: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            }, {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            }>;
            selectionDecision: z.ZodEffects<z.ZodObject<{
                methodId: z.ZodLiteral<"F7_MODEL_SELECTION_V1">;
                status: z.ZodEnum<["unique_preference", "no_unique_preference", "no_acceptable_model", "withheld_candidate_failures"]>;
                numericBestFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
                competitiveFamilies: z.ZodArray<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>, "many">;
                engineeringDefaultFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
                proposedFinalFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
                confidence: z.ZodEnum<["low", "moderate"]>;
                reasonCodes: z.ZodArray<z.ZodEnum<["SINGLE_ACCEPTABLE_COMPETITOR", "MULTIPLE_COMPETITIVE_MODELS", "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT", "SMALL_SAMPLE_UNCERTAINTY", "NO_ACCEPTABLE_MODEL", "CANDIDATE_FIT_FAILURES"]>, "many">;
            }, "strict", z.ZodTypeAny, {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            }, {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            }>, {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            }, {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            }>;
        }, "strict", z.ZodTypeAny, {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        }, {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        }>, {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        }, {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        }>>;
        distributionApproval: z.ZodOptional<z.ZodObject<{
            factorId: z.ZodString;
            family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
            confirmed: z.ZodLiteral<true>;
            approvedAt: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        }, {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        }>>;
    }, "strict", z.ZodTypeAny, {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        };
        input?: {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        setup?: {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        } | undefined;
        datasetValidation?: {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        } | undefined;
        measurementPasteResult?: {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        } | undefined;
    }, {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        };
        input?: {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        setup?: {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        } | undefined;
        datasetValidation?: {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        } | undefined;
        measurementPasteResult?: {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        } | undefined;
    }>, {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        };
        input?: {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        setup?: {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        } | undefined;
        datasetValidation?: {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        } | undefined;
        measurementPasteResult?: {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        } | undefined;
    }, {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        };
        input?: {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        setup?: {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        } | undefined;
        datasetValidation?: {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        } | undefined;
        measurementPasteResult?: {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        } | undefined;
    }>, "many">;
    monteCarloResult: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        methodId: z.ZodLiteral<"F7_MONTE_CARLO_V1">;
        status: z.ZodLiteral<"complete">;
        lowerSpecLimit: z.ZodNumber;
        upperSpecLimit: z.ZodNumber;
        targetSigmaLevel: z.ZodNumber;
        iterations: z.ZodUnion<[z.ZodLiteral<10000>, z.ZodLiteral<100000>]>;
        runSeed: z.ZodString;
        correlationMode: z.ZodLiteral<"INDEPENDENT">;
        mean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        quantiles: z.ZodEffects<z.ZodObject<{
            p00135: z.ZodNumber;
            p01: z.ZodNumber;
            p05: z.ZodNumber;
            p50: z.ZodNumber;
            p95: z.ZodNumber;
            p99: z.ZodNumber;
            p99865: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        }, {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        }>, {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        }, {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        }>;
        inSpecCount: z.ZodNumber;
        outOfSpecCount: z.ZodNumber;
        yield: z.ZodNumber;
        outOfSpecProbability: z.ZodNumber;
        ppm: z.ZodNumber;
        histogram: z.ZodObject<{
            methodId: z.ZodLiteral<"F7_HISTOGRAM_FD_V1">;
            bins: z.ZodArray<z.ZodObject<{
                minimum: z.ZodNumber;
                maximum: z.ZodNumber;
                observedCount: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                minimum: number;
                maximum: number;
                observedCount: number;
            }, {
                minimum: number;
                maximum: number;
                observedCount: number;
            }>, "many">;
        }, "strict", z.ZodTypeAny, {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        }, {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        }>;
        normalFit: z.ZodObject<{
            methodId: z.ZodLiteral<"F7_NORMAL_MOMENT_FIT_V1">;
            mean: z.ZodNumber;
            standardDeviation: z.ZodNumber;
            expectedBinCounts: z.ZodArray<z.ZodNumber, "many">;
        }, "strict", z.ZodTypeAny, {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        }, {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        }>;
        capability: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            cp: z.ZodNumber;
            lowerCpk: z.ZodNumber;
            upperCpk: z.ZodNumber;
            cpk: z.ZodNumber;
            targetCpk: z.ZodNumber;
            targetStatus: z.ZodEnum<["meets_target", "below_target"]>;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        }, {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        }>, z.ZodObject<{
            status: z.ZodLiteral<"not_available">;
            reason: z.ZodLiteral<"zero_variance">;
            targetCpk: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        }, {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        }>]>;
        normalModel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            lowerTailDpm: z.ZodNumber;
            upperTailDpm: z.ZodNumber;
            totalDpm: z.ZodNumber;
            expectedYield: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        }, {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"not_available">;
            reason: z.ZodLiteral<"zero_variance">;
        }, "strict", z.ZodTypeAny, {
            status: "not_available";
            reason: "zero_variance";
        }, {
            status: "not_available";
            reason: "zero_variance";
        }>]>;
        factorManifest: z.ZodArray<z.ZodObject<{
            factorId: z.ZodString;
            family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
            sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
        }, "strict", z.ZodTypeAny, {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }, {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }, {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }>, {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }, {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }>>;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
    status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
    outputClassification: "confidential";
    contractId: "f7-analysis-result-v1";
    workbook: {
        fileName: string;
        workbookContentHash: string;
    };
    selectedWorksheetNames: string[];
    factors: {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        };
        input?: {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        setup?: {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        } | undefined;
        datasetValidation?: {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        } | undefined;
        measurementPasteResult?: {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        } | undefined;
    }[];
    worksheetOptions: {
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
        worksheetName: string;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        selectionIndex: number;
    }[];
    systemSpecification?: {
        status: "available";
        designNominal: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        lowerSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        upperSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        targetSigmaLevel: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        additionalMeanShift: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    } | {
        status: "unavailable";
        reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
        designNominal?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        lowerSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        upperSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        targetSigmaLevel?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        additionalMeanShift?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    } | undefined;
    dimensionChainImage?: {
        status: "available";
        contentHash: string;
        worksheetName: string;
        url: string;
    } | undefined;
    monteCarloResult?: {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    } | undefined;
}, {
    sessionId: string;
    status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
    outputClassification: "confidential";
    contractId: "f7-analysis-result-v1";
    workbook: {
        fileName: string;
        workbookContentHash: string;
    };
    selectedWorksheetNames: string[];
    factors: {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        };
        input?: {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        setup?: {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        } | undefined;
        datasetValidation?: {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        } | undefined;
        measurementPasteResult?: {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        } | undefined;
    }[];
    worksheetOptions: {
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
        worksheetName: string;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        selectionIndex: number;
    }[];
    systemSpecification?: {
        status: "available";
        designNominal: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        lowerSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        upperSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        targetSigmaLevel: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        additionalMeanShift: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    } | {
        status: "unavailable";
        reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
        designNominal?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        lowerSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        upperSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        targetSigmaLevel?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        additionalMeanShift?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    } | undefined;
    dimensionChainImage?: {
        status: "available";
        contentHash: string;
        worksheetName: string;
        url: string;
    } | undefined;
    monteCarloResult?: {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    } | undefined;
}>, {
    sessionId: string;
    status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
    outputClassification: "confidential";
    contractId: "f7-analysis-result-v1";
    workbook: {
        fileName: string;
        workbookContentHash: string;
    };
    selectedWorksheetNames: string[];
    factors: {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        };
        input?: {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        setup?: {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        } | undefined;
        datasetValidation?: {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        } | undefined;
        measurementPasteResult?: {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        } | undefined;
    }[];
    worksheetOptions: {
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
        worksheetName: string;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        selectionIndex: number;
    }[];
    systemSpecification?: {
        status: "available";
        designNominal: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        lowerSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        upperSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        targetSigmaLevel: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        additionalMeanShift: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    } | {
        status: "unavailable";
        reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
        designNominal?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        lowerSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        upperSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        targetSigmaLevel?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        additionalMeanShift?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    } | undefined;
    dimensionChainImage?: {
        status: "available";
        contentHash: string;
        worksheetName: string;
        url: string;
    } | undefined;
    monteCarloResult?: {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    } | undefined;
}, {
    sessionId: string;
    status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
    outputClassification: "confidential";
    contractId: "f7-analysis-result-v1";
    workbook: {
        fileName: string;
        workbookContentHash: string;
    };
    selectedWorksheetNames: string[];
    factors: {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            standardDeviation: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
        };
        input?: {
            mode: "MEASURED";
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            tolerance: number;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            upperTolerance: number;
            lowerTolerance: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            oneSigma: number;
            percentContributionToSigma: number;
            longTermSafetyFactor: number;
            designNominal: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sigmaLevel: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            factorId: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 0 | 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            } | {
                minimum: number;
                maximum: number;
                standardDeviation: number;
                samplerId: "UNIFORM_BOUNDED_V1";
                physicalMean: number;
                support: "BOUNDED_REAL";
            };
            calculatedMean: number;
            userAdded?: true | undefined;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        setup?: {
            confirmed: true;
            upperTolerance: number;
            lowerTolerance: number;
            designNominal: number;
            factorCandidateId: string;
            factorName?: string | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            userAdded?: true | undefined;
        } | undefined;
        datasetValidation?: {
            status: "blocked" | "ready";
            blockingIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                uniform: "eligible_with_boundary_warning";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
            };
        } | undefined;
        measurementPasteResult?: {
            validation: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            };
            status: "blocked" | "ready";
            factorId: string;
            dataset?: {
                unit: string;
                contentHash: string;
                observations: ({
                    value: number;
                    disposition: "included";
                    originalRow: number;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                } | {
                    value: number;
                    confirmed: true;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    disposition: "excluded";
                    originalRow: number;
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                factorId: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                rationalSubgroupConfig?: {
                    subgroupSize: number;
                    estimator: "RANGE_D2" | "S_C4";
                } | undefined;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            candidates: {
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                parameterCount: number;
                parameters: Record<string, number>;
                logLikelihood: number;
                aic: number;
                aicc: number;
                bic: number;
                deltaAicc: number;
                deltaBic: number;
                ks: number;
                ad: number;
                qqPoints: {
                    observed: number;
                    theoretical: number;
                }[];
                bootstrap: {
                    status: "rejected" | "acceptable" | "weak";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                        level: 0.95;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                };
                warnings: string[];
            }[];
            factorId: string;
            sampleSize: number;
            characteristicKind: "other" | "dimensional";
            failedCandidates: {
                reasonCode: "numerical_fit_failed";
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            }[];
            sampleDiagnostics: {
                mean: number;
                median: number;
                skewness: number;
                coefficientOfVariation: number;
                meanMedianRelativeDifference: number;
                normalQqCurvature: number;
            };
            selectionDecision: {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            approvedAt: string;
        } | undefined;
    }[];
    worksheetOptions: {
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
        worksheetName: string;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        selectionIndex: number;
    }[];
    systemSpecification?: {
        status: "available";
        designNominal: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        lowerSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        upperSpecLimit: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        targetSigmaLevel: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        additionalMeanShift: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        };
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    } | {
        status: "unavailable";
        reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
        designNominal?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        lowerSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        upperSpecLimit?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        targetSigmaLevel?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        additionalMeanShift?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
        volume?: {
            status: "available";
            actualValue: number;
            displayValue: string;
            sourceLabel: string;
            valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
            sourceCell?: string | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
            sourceCell?: string | undefined;
        } | undefined;
    } | undefined;
    dimensionChainImage?: {
        status: "available";
        contentHash: string;
        worksheetName: string;
        url: string;
    } | undefined;
    monteCarloResult?: {
        status: "complete";
        capability: {
            status: "available";
            cpk: number;
            targetCpk: number;
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            targetCpk: number;
            reason: "zero_variance";
        };
        mean: number;
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        yield: number;
        methodId: "F7_MONTE_CARLO_V1";
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        quantiles: {
            p00135: number;
            p01: number;
            p05: number;
            p50: number;
            p95: number;
            p99: number;
            p99865: number;
        };
        inSpecCount: number;
        outOfSpecCount: number;
        outOfSpecProbability: number;
        ppm: number;
        histogram: {
            methodId: "F7_HISTOGRAM_FD_V1";
            bins: {
                minimum: number;
                maximum: number;
                observedCount: number;
            }[];
        };
        normalFit: {
            mean: number;
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            expectedBinCounts: number[];
        };
        normalModel: {
            status: "available";
            totalDpm: number;
            lowerTailDpm: number;
            upperTailDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    } | undefined;
}>;
export declare const f7WorkbookImportRequestSchema: z.ZodObject<{
    contractId: z.ZodLiteral<"f7-analysis-request-v1">;
    inputClassification: z.ZodLiteral<"confidential">;
    fileName: z.ZodString;
    workbookBytes: z.ZodEffects<z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>, Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>;
}, "strict", z.ZodTypeAny, {
    inputClassification: "confidential";
    contractId: "f7-analysis-request-v1";
    fileName: string;
    workbookBytes: Uint8Array<ArrayBuffer>;
}, {
    inputClassification: "confidential";
    contractId: "f7-analysis-request-v1";
    fileName: string;
    workbookBytes: Uint8Array<ArrayBuffer>;
}>;
export declare const f7MeasurementPasteRequestSchema: z.ZodEffects<z.ZodObject<{
    factorId: z.ZodString;
    unit: z.ZodString;
    structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
    rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
        subgroupSize: z.ZodNumber;
        estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
    }, "strict", z.ZodTypeAny, {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    }, {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    }>>;
    sourceReference: z.ZodString;
    msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
    text: z.ZodString;
}, "strict", z.ZodTypeAny, {
    unit: string;
    text: string;
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    msaStatus: "unknown" | "available" | "not_available";
    rationalSubgroupConfig?: {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    } | undefined;
}, {
    unit: string;
    text: string;
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    msaStatus: "unknown" | "available" | "not_available";
    rationalSubgroupConfig?: {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    } | undefined;
}>, {
    unit: string;
    text: string;
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    msaStatus: "unknown" | "available" | "not_available";
    rationalSubgroupConfig?: {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    } | undefined;
}, {
    unit: string;
    text: string;
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    msaStatus: "unknown" | "available" | "not_available";
    rationalSubgroupConfig?: {
        subgroupSize: number;
        estimator: "RANGE_D2" | "S_C4";
    } | undefined;
}>;
export declare const f7MeasurementDispositionActionSchema: z.ZodEnum<["EXCLUDE", "RESTORE"]>;
export declare const f7MeasurementDispositionRequestSchema: z.ZodObject<{
    factorId: z.ZodString;
    rowNumbers: z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>;
    action: z.ZodEnum<["EXCLUDE", "RESTORE"]>;
    reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
    operatorReference: z.ZodString;
    confirmed: z.ZodLiteral<true>;
}, "strict", z.ZodTypeAny, {
    confirmed: true;
    action: "EXCLUDE" | "RESTORE";
    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
    factorId: string;
    operatorReference: string;
    rowNumbers: number[];
}, {
    confirmed: true;
    action: "EXCLUDE" | "RESTORE";
    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
    factorId: string;
    operatorReference: string;
    rowNumbers: number[];
}>;
export declare const f7AnalysisRequestSchema: z.ZodObject<{
    contractId: z.ZodLiteral<"f7-analysis-request-v1">;
    inputClassification: z.ZodLiteral<"confidential">;
    sessionId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
    inputClassification: "confidential";
    contractId: "f7-analysis-request-v1";
}, {
    sessionId: string;
    inputClassification: "confidential";
    contractId: "f7-analysis-request-v1";
}>;
export declare const f7AnalysisResultSchema: z.ZodObject<{
    contractId: z.ZodLiteral<"f7-analysis-result-v1">;
    outputClassification: z.ZodLiteral<"confidential">;
    snapshot: z.ZodEffects<z.ZodObject<{
        contractId: z.ZodLiteral<"f7-analysis-result-v1">;
        outputClassification: z.ZodLiteral<"confidential">;
        sessionId: z.ZodString;
        status: z.ZodEnum<["worksheet_selection", "factor_setup", "measurement_entry", "phase_1_ready"]>;
        workbook: z.ZodObject<{
            fileName: z.ZodString;
            workbookContentHash: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            fileName: string;
            workbookContentHash: string;
        }, {
            fileName: string;
            workbookContentHash: string;
        }>;
        selectedWorksheetNames: z.ZodArray<z.ZodString, "many">;
        worksheetOptions: z.ZodArray<z.ZodObject<{
            selectionIndex: z.ZodNumber;
            worksheetName: z.ZodString;
            toleranceLoopDescription: z.ZodString;
            worksheetKind: z.ZodEnum<["analysis", "example_or_template"]>;
            source: z.ZodUnion<[z.ZodObject<{
                summarySheet: z.ZodLiteral<"Auto Summary">;
                summaryRow: z.ZodNumber;
                worksheetAnchor: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            }, {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            }>, z.ZodObject<{
                discoveryMethod: z.ZodLiteral<"worksheet_scan">;
                descriptionCell: z.ZodString;
                worksheetAnchor: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            }, {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            }>]>;
        }, "strict", z.ZodTypeAny, {
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
            worksheetName: string;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            selectionIndex: number;
        }, {
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
            worksheetName: string;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            selectionIndex: number;
        }>, "many">;
        dimensionChainImage: z.ZodOptional<z.ZodObject<{
            status: z.ZodLiteral<"available">;
            worksheetName: z.ZodString;
            contentHash: z.ZodString;
            url: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            contentHash: string;
            worksheetName: string;
            url: string;
        }, {
            status: "available";
            contentHash: string;
            worksheetName: string;
            url: string;
        }>>;
        systemSpecification: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            designNominal: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>;
            lowerSpecLimit: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>;
            upperSpecLimit: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>;
            targetSigmaLevel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>;
            additionalMeanShift: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>;
            volume: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>>;
            status: z.ZodLiteral<"available">;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            designNominal: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            lowerSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            upperSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            targetSigmaLevel: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            additionalMeanShift: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        }, {
            status: "available";
            designNominal: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            lowerSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            upperSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            targetSigmaLevel: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            additionalMeanShift: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        }>, z.ZodObject<{
            status: z.ZodLiteral<"unavailable">;
            reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "system_specification_range_invalid", "legacy_artifact_missing_system_specification"]>;
            designNominal: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>>;
            lowerSpecLimit: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>>;
            upperSpecLimit: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>>;
            targetSigmaLevel: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>>;
            additionalMeanShift: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>>;
            volume: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                actualValue: z.ZodNumber;
                displayValue: z.ZodString;
                sourceLabel: z.ZodString;
                sourceCell: z.ZodOptional<z.ZodString>;
                valueOrigin: z.ZodEnum<["numeric_literal", "formula_cached", "defaulted"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }, {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"unavailable">;
                reasonCode: z.ZodEnum<["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]>;
                sourceCell: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }, {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            }>]>>;
        }, "strict", z.ZodTypeAny, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
            designNominal?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            lowerSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            upperSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            targetSigmaLevel?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            additionalMeanShift?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        }, {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
            designNominal?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            lowerSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            upperSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            targetSigmaLevel?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            additionalMeanShift?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        }>]>>;
        factors: z.ZodArray<z.ZodEffects<z.ZodObject<{
            factorCandidate: z.ZodEffects<z.ZodObject<{
                longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
                sigmaLevel: z.ZodOptional<z.ZodNumber>;
                standardDeviation: z.ZodNumber;
                distribution: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
                lowerSpecLimit: z.ZodNumber;
                upperSpecLimit: z.ZodNumber;
                designNominal: z.ZodNumber;
                upperTolerance: z.ZodNumber;
                lowerTolerance: z.ZodNumber;
                workbookContentHash: z.ZodString;
                worksheetName: z.ZodString;
                tableId: z.ZodString;
                sourceRow: z.ZodNumber;
                sourceCells: z.ZodRecord<z.ZodString, z.ZodString>;
                factorCandidateId: z.ZodString;
                factorName: z.ZodString;
                userAdded: z.ZodOptional<z.ZodLiteral<true>>;
                workbookUnitEvidence: z.ZodOptional<z.ZodString>;
                excelSignedMean: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            }, {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            }>, {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            }, {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            }>;
            setup: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
                sigmaLevel: z.ZodOptional<z.ZodNumber>;
                distribution: z.ZodOptional<z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>>;
                confirmed: z.ZodLiteral<true>;
                designNominal: z.ZodNumber;
                upperTolerance: z.ZodNumber;
                lowerTolerance: z.ZodNumber;
                factorCandidateId: z.ZodString;
                factorName: z.ZodOptional<z.ZodString>;
                userAdded: z.ZodOptional<z.ZodLiteral<true>>;
            }, "strict", z.ZodTypeAny, {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            }, {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            }>, {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            }, {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            }>>;
            sourceMode: z.ZodOptional<z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>>;
            input: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
                mode: z.ZodLiteral<"MEASURED">;
                dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                    factorId: z.ZodString;
                    unit: z.ZodString;
                    structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
                    rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
                        subgroupSize: z.ZodNumber;
                        estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
                    }, "strict", z.ZodTypeAny, {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    }, {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    }>>;
                    sourceReference: z.ZodString;
                    importedAt: z.ZodString;
                    msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
                    observations: z.ZodArray<z.ZodDiscriminatedUnion<"disposition", [z.ZodObject<{
                        disposition: z.ZodLiteral<"included">;
                        value: z.ZodNumber;
                        originalRow: z.ZodNumber;
                        sequence: z.ZodOptional<z.ZodString>;
                        timestamp: z.ZodOptional<z.ZodString>;
                        subgroup: z.ZodOptional<z.ZodString>;
                        batch: z.ZodOptional<z.ZodString>;
                    }, "strict", z.ZodTypeAny, {
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }, {
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }>, z.ZodObject<{
                        disposition: z.ZodLiteral<"excluded">;
                        reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
                        operatorReference: z.ZodString;
                        confirmed: z.ZodLiteral<true>;
                        value: z.ZodNumber;
                        originalRow: z.ZodNumber;
                        sequence: z.ZodOptional<z.ZodString>;
                        timestamp: z.ZodOptional<z.ZodString>;
                        subgroup: z.ZodOptional<z.ZodString>;
                        batch: z.ZodOptional<z.ZodString>;
                    }, "strict", z.ZodTypeAny, {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }, {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }>]>, "many">;
                    missingRowCount: z.ZodNumber;
                    rejectionSummaries: z.ZodArray<z.ZodObject<{
                        rowNumber: z.ZodNumber;
                        reason: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
                    }, "strict", z.ZodTypeAny, {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }, {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }>, "many">;
                    originalRowCount: z.ZodNumber;
                    analyzedCount: z.ZodNumber;
                    contentHash: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                }, {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                }>, {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                }, {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                }>>;
            }, "strict", z.ZodTypeAny, {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            }, {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            }>, z.ZodObject<{
                mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
                baselineSampler: z.ZodEffects<z.ZodDiscriminatedUnion<"samplerId", [z.ZodObject<{
                    samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
                    physicalMean: z.ZodNumber;
                    standardDeviation: z.ZodNumber;
                    support: z.ZodLiteral<"REAL">;
                }, "strict", z.ZodTypeAny, {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                }, {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                }>, z.ZodObject<{
                    samplerId: z.ZodLiteral<"UNIFORM_BOUNDED_V1">;
                    physicalMean: z.ZodNumber;
                    standardDeviation: z.ZodNumber;
                    minimum: z.ZodNumber;
                    maximum: z.ZodNumber;
                    support: z.ZodLiteral<"BOUNDED_REAL">;
                }, "strict", z.ZodTypeAny, {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                }, {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                }>]>, {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                }, {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                }>;
            }, "strict", z.ZodTypeAny, {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            }, {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            }>]>>;
            evidence: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<0>, z.ZodLiteral<1>]>;
                physicalMean: z.ZodNumber;
                signedContributionMean: z.ZodNumber;
                baselineSampler: z.ZodEffects<z.ZodDiscriminatedUnion<"samplerId", [z.ZodObject<{
                    samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
                    physicalMean: z.ZodNumber;
                    standardDeviation: z.ZodNumber;
                    support: z.ZodLiteral<"REAL">;
                }, "strict", z.ZodTypeAny, {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                }, {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                }>, z.ZodObject<{
                    samplerId: z.ZodLiteral<"UNIFORM_BOUNDED_V1">;
                    physicalMean: z.ZodNumber;
                    standardDeviation: z.ZodNumber;
                    minimum: z.ZodNumber;
                    maximum: z.ZodNumber;
                    support: z.ZodLiteral<"BOUNDED_REAL">;
                }, "strict", z.ZodTypeAny, {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                }, {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                }>]>, {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                }, {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                }>;
                lowerSpecLimit: z.ZodNumber;
                upperSpecLimit: z.ZodNumber;
                calculatedMean: z.ZodNumber;
                tolerance: z.ZodNumber;
                oneSigma: z.ZodNumber;
                percentContributionToSigma: z.ZodNumber;
                longTermSafetyFactor: z.ZodNumber;
                sigmaLevel: z.ZodNumber;
                distribution: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
                designNominal: z.ZodNumber;
                upperTolerance: z.ZodNumber;
                lowerTolerance: z.ZodNumber;
                workbookContentHash: z.ZodString;
                worksheetName: z.ZodString;
                tableId: z.ZodString;
                sourceRow: z.ZodNumber;
                sourceCells: z.ZodRecord<z.ZodString, z.ZodString>;
                factorCandidateId: z.ZodString;
                factorId: z.ZodString;
                factorName: z.ZodString;
                userAdded: z.ZodOptional<z.ZodLiteral<true>>;
                unit: z.ZodString;
                unitSource: z.ZodEnum<["workbook", "user_confirmed", "unspecified"]>;
            }, "strict", z.ZodTypeAny, {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            }, {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            }>, {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            }, {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            }>>;
            datasetValidation: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<["ready", "blocked"]>;
                blockingIssues: z.ZodArray<z.ZodObject<{
                    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                    factorId: z.ZodOptional<z.ZodString>;
                    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                }, "strict", z.ZodTypeAny, {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }, {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }>, "many">;
                advisoryIssues: z.ZodArray<z.ZodObject<{
                    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                    factorId: z.ZodOptional<z.ZodString>;
                    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                }, "strict", z.ZodTypeAny, {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }, {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }>, "many">;
                candidateEligibility: z.ZodObject<{
                    normal: z.ZodLiteral<"eligible">;
                    lognormal: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                    weibull: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                    gamma: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                    uniform: z.ZodLiteral<"eligible_with_boundary_warning">;
                }, "strict", z.ZodTypeAny, {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                }, {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                }>;
            }, "strict", z.ZodTypeAny, {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            }, {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            }>>;
            measurementPasteResult: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<["ready", "blocked"]>;
                factorId: z.ZodString;
                dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                    factorId: z.ZodString;
                    unit: z.ZodString;
                    structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
                    rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
                        subgroupSize: z.ZodNumber;
                        estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
                    }, "strict", z.ZodTypeAny, {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    }, {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    }>>;
                    sourceReference: z.ZodString;
                    importedAt: z.ZodString;
                    msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
                    observations: z.ZodArray<z.ZodDiscriminatedUnion<"disposition", [z.ZodObject<{
                        disposition: z.ZodLiteral<"included">;
                        value: z.ZodNumber;
                        originalRow: z.ZodNumber;
                        sequence: z.ZodOptional<z.ZodString>;
                        timestamp: z.ZodOptional<z.ZodString>;
                        subgroup: z.ZodOptional<z.ZodString>;
                        batch: z.ZodOptional<z.ZodString>;
                    }, "strict", z.ZodTypeAny, {
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }, {
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }>, z.ZodObject<{
                        disposition: z.ZodLiteral<"excluded">;
                        reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
                        operatorReference: z.ZodString;
                        confirmed: z.ZodLiteral<true>;
                        value: z.ZodNumber;
                        originalRow: z.ZodNumber;
                        sequence: z.ZodOptional<z.ZodString>;
                        timestamp: z.ZodOptional<z.ZodString>;
                        subgroup: z.ZodOptional<z.ZodString>;
                        batch: z.ZodOptional<z.ZodString>;
                    }, "strict", z.ZodTypeAny, {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }, {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }>]>, "many">;
                    missingRowCount: z.ZodNumber;
                    rejectionSummaries: z.ZodArray<z.ZodObject<{
                        rowNumber: z.ZodNumber;
                        reason: z.ZodEnum<["non_finite_value", "invalid_row", "missing_value"]>;
                    }, "strict", z.ZodTypeAny, {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }, {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }>, "many">;
                    originalRowCount: z.ZodNumber;
                    analyzedCount: z.ZodNumber;
                    contentHash: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                }, {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                }>, {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                }, {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                }>>;
                validation: z.ZodObject<{
                    status: z.ZodEnum<["ready", "blocked"]>;
                    blockingIssues: z.ZodArray<z.ZodObject<{
                        reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                        factorId: z.ZodOptional<z.ZodString>;
                        rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                    }, "strict", z.ZodTypeAny, {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }, {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }>, "many">;
                    advisoryIssues: z.ZodArray<z.ZodObject<{
                        reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                        factorId: z.ZodOptional<z.ZodString>;
                        rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                    }, "strict", z.ZodTypeAny, {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }, {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }>, "many">;
                    candidateEligibility: z.ZodObject<{
                        normal: z.ZodLiteral<"eligible">;
                        lognormal: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                        weibull: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                        gamma: z.ZodEnum<["eligible", "ineligible_nonpositive"]>;
                        uniform: z.ZodLiteral<"eligible_with_boundary_warning">;
                    }, "strict", z.ZodTypeAny, {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    }, {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    }>;
                }, "strict", z.ZodTypeAny, {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                }, {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                }>;
            }, "strict", z.ZodTypeAny, {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            }, {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            }>>;
            distributionFitResult: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                factorId: z.ZodString;
                sampleSize: z.ZodNumber;
                characteristicKind: z.ZodEnum<["dimensional", "other"]>;
                candidates: z.ZodArray<z.ZodEffects<z.ZodObject<{
                    family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
                    modelSpecification: z.ZodEnum<["normal_location_scale", "lognormal_location_zero", "lognormal_location_free", "weibull_location_zero", "weibull_location_free", "gamma_location_zero", "gamma_location_free", "uniform_boundary_mle"]>;
                    parameterCount: z.ZodNumber;
                    parameters: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodNumber>, Record<string, number>, Record<string, number>>;
                    logLikelihood: z.ZodNumber;
                    aic: z.ZodNumber;
                    aicc: z.ZodNumber;
                    bic: z.ZodNumber;
                    deltaAicc: z.ZodNumber;
                    deltaBic: z.ZodNumber;
                    ks: z.ZodNumber;
                    ad: z.ZodNumber;
                    qqPoints: z.ZodEffects<z.ZodArray<z.ZodObject<{
                        observed: z.ZodNumber;
                        theoretical: z.ZodNumber;
                    }, "strict", z.ZodTypeAny, {
                        observed: number;
                        theoretical: number;
                    }, {
                        observed: number;
                        theoretical: number;
                    }>, "many">, {
                        observed: number;
                        theoretical: number;
                    }[], {
                        observed: number;
                        theoretical: number;
                    }[]>;
                    bootstrap: z.ZodEffects<z.ZodObject<{
                        statisticId: z.ZodLiteral<"anderson_darling">;
                        observedStatistic: z.ZodNumber;
                        comparisonDirection: z.ZodLiteral<"greater_than_or_equal">;
                        refitEachReplicate: z.ZodLiteral<true>;
                        extremeReplicateCount: z.ZodNumber;
                        confidenceInterval: z.ZodEffects<z.ZodObject<{
                            level: z.ZodLiteral<0.95>;
                            method: z.ZodLiteral<"wilson_score">;
                            lower: z.ZodNumber;
                            upper: z.ZodNumber;
                        }, "strict", z.ZodTypeAny, {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        }, {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        }>, {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        }, {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        }>;
                        pValue: z.ZodNumber;
                        replicates: z.ZodLiteral<10000>;
                        seed: z.ZodString;
                        methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
                        candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
                        streamDigest: z.ZodString;
                        status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
                    }, "strict", z.ZodTypeAny, {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    }, {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    }>, {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    }, {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    }>;
                    warnings: z.ZodArray<z.ZodString, "many">;
                }, "strict", z.ZodTypeAny, {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }, {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }>, {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }, {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }>, "many">;
                failedCandidates: z.ZodArray<z.ZodObject<{
                    family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
                    reasonCode: z.ZodLiteral<"numerical_fit_failed">;
                }, "strict", z.ZodTypeAny, {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }, {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }>, "many">;
                sampleDiagnostics: z.ZodObject<{
                    mean: z.ZodNumber;
                    median: z.ZodNumber;
                    skewness: z.ZodNumber;
                    coefficientOfVariation: z.ZodNumber;
                    meanMedianRelativeDifference: z.ZodNumber;
                    normalQqCurvature: z.ZodNumber;
                }, "strict", z.ZodTypeAny, {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                }, {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                }>;
                selectionDecision: z.ZodEffects<z.ZodObject<{
                    methodId: z.ZodLiteral<"F7_MODEL_SELECTION_V1">;
                    status: z.ZodEnum<["unique_preference", "no_unique_preference", "no_acceptable_model", "withheld_candidate_failures"]>;
                    numericBestFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
                    competitiveFamilies: z.ZodArray<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>, "many">;
                    engineeringDefaultFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
                    proposedFinalFamily: z.ZodOptional<z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>>;
                    confidence: z.ZodEnum<["low", "moderate"]>;
                    reasonCodes: z.ZodArray<z.ZodEnum<["SINGLE_ACCEPTABLE_COMPETITOR", "MULTIPLE_COMPETITIVE_MODELS", "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT", "SMALL_SAMPLE_UNCERTAINTY", "NO_ACCEPTABLE_MODEL", "CANDIDATE_FIT_FAILURES"]>, "many">;
                }, "strict", z.ZodTypeAny, {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                }, {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                }>, {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                }, {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                }>;
            }, "strict", z.ZodTypeAny, {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            }, {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            }>, {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            }, {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            }>>;
            distributionApproval: z.ZodOptional<z.ZodObject<{
                factorId: z.ZodString;
                family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
                confirmed: z.ZodLiteral<true>;
                approvedAt: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            }, {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            }>>;
        }, "strict", z.ZodTypeAny, {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }, {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }>, {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }, {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }>, "many">;
        monteCarloResult: z.ZodOptional<z.ZodEffects<z.ZodObject<{
            methodId: z.ZodLiteral<"F7_MONTE_CARLO_V1">;
            status: z.ZodLiteral<"complete">;
            lowerSpecLimit: z.ZodNumber;
            upperSpecLimit: z.ZodNumber;
            targetSigmaLevel: z.ZodNumber;
            iterations: z.ZodUnion<[z.ZodLiteral<10000>, z.ZodLiteral<100000>]>;
            runSeed: z.ZodString;
            correlationMode: z.ZodLiteral<"INDEPENDENT">;
            mean: z.ZodNumber;
            standardDeviation: z.ZodNumber;
            quantiles: z.ZodEffects<z.ZodObject<{
                p00135: z.ZodNumber;
                p01: z.ZodNumber;
                p05: z.ZodNumber;
                p50: z.ZodNumber;
                p95: z.ZodNumber;
                p99: z.ZodNumber;
                p99865: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            }, {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            }>, {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            }, {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            }>;
            inSpecCount: z.ZodNumber;
            outOfSpecCount: z.ZodNumber;
            yield: z.ZodNumber;
            outOfSpecProbability: z.ZodNumber;
            ppm: z.ZodNumber;
            histogram: z.ZodObject<{
                methodId: z.ZodLiteral<"F7_HISTOGRAM_FD_V1">;
                bins: z.ZodArray<z.ZodObject<{
                    minimum: z.ZodNumber;
                    maximum: z.ZodNumber;
                    observedCount: z.ZodNumber;
                }, "strict", z.ZodTypeAny, {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }, {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }>, "many">;
            }, "strict", z.ZodTypeAny, {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            }, {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            }>;
            normalFit: z.ZodObject<{
                methodId: z.ZodLiteral<"F7_NORMAL_MOMENT_FIT_V1">;
                mean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                expectedBinCounts: z.ZodArray<z.ZodNumber, "many">;
            }, "strict", z.ZodTypeAny, {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            }, {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            }>;
            capability: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                cp: z.ZodNumber;
                lowerCpk: z.ZodNumber;
                upperCpk: z.ZodNumber;
                cpk: z.ZodNumber;
                targetCpk: z.ZodNumber;
                targetStatus: z.ZodEnum<["meets_target", "below_target"]>;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            }, {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            }>, z.ZodObject<{
                status: z.ZodLiteral<"not_available">;
                reason: z.ZodLiteral<"zero_variance">;
                targetCpk: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            }, {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            }>]>;
            normalModel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                lowerTailDpm: z.ZodNumber;
                upperTailDpm: z.ZodNumber;
                totalDpm: z.ZodNumber;
                expectedYield: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            }, {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            }>, z.ZodObject<{
                status: z.ZodLiteral<"not_available">;
                reason: z.ZodLiteral<"zero_variance">;
            }, "strict", z.ZodTypeAny, {
                status: "not_available";
                reason: "zero_variance";
            }, {
                status: "not_available";
                reason: "zero_variance";
            }>]>;
            factorManifest: z.ZodArray<z.ZodObject<{
                factorId: z.ZodString;
                family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
                sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
            }, "strict", z.ZodTypeAny, {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }, {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }>, "many">;
        }, "strict", z.ZodTypeAny, {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        }, {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        }>, {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        }, {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        }>>;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        outputClassification: "confidential";
        contractId: "f7-analysis-result-v1";
        workbook: {
            fileName: string;
            workbookContentHash: string;
        };
        selectedWorksheetNames: string[];
        factors: {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }[];
        worksheetOptions: {
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
            worksheetName: string;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            selectionIndex: number;
        }[];
        systemSpecification?: {
            status: "available";
            designNominal: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            lowerSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            upperSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            targetSigmaLevel: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            additionalMeanShift: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
            designNominal?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            lowerSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            upperSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            targetSigmaLevel?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            additionalMeanShift?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | undefined;
        dimensionChainImage?: {
            status: "available";
            contentHash: string;
            worksheetName: string;
            url: string;
        } | undefined;
        monteCarloResult?: {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    }, {
        sessionId: string;
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        outputClassification: "confidential";
        contractId: "f7-analysis-result-v1";
        workbook: {
            fileName: string;
            workbookContentHash: string;
        };
        selectedWorksheetNames: string[];
        factors: {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }[];
        worksheetOptions: {
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
            worksheetName: string;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            selectionIndex: number;
        }[];
        systemSpecification?: {
            status: "available";
            designNominal: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            lowerSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            upperSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            targetSigmaLevel: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            additionalMeanShift: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
            designNominal?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            lowerSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            upperSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            targetSigmaLevel?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            additionalMeanShift?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | undefined;
        dimensionChainImage?: {
            status: "available";
            contentHash: string;
            worksheetName: string;
            url: string;
        } | undefined;
        monteCarloResult?: {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    }>, {
        sessionId: string;
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        outputClassification: "confidential";
        contractId: "f7-analysis-result-v1";
        workbook: {
            fileName: string;
            workbookContentHash: string;
        };
        selectedWorksheetNames: string[];
        factors: {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }[];
        worksheetOptions: {
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
            worksheetName: string;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            selectionIndex: number;
        }[];
        systemSpecification?: {
            status: "available";
            designNominal: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            lowerSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            upperSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            targetSigmaLevel: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            additionalMeanShift: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
            designNominal?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            lowerSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            upperSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            targetSigmaLevel?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            additionalMeanShift?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | undefined;
        dimensionChainImage?: {
            status: "available";
            contentHash: string;
            worksheetName: string;
            url: string;
        } | undefined;
        monteCarloResult?: {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    }, {
        sessionId: string;
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        outputClassification: "confidential";
        contractId: "f7-analysis-result-v1";
        workbook: {
            fileName: string;
            workbookContentHash: string;
        };
        selectedWorksheetNames: string[];
        factors: {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }[];
        worksheetOptions: {
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
            worksheetName: string;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            selectionIndex: number;
        }[];
        systemSpecification?: {
            status: "available";
            designNominal: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            lowerSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            upperSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            targetSigmaLevel: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            additionalMeanShift: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
            designNominal?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            lowerSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            upperSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            targetSigmaLevel?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            additionalMeanShift?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | undefined;
        dimensionChainImage?: {
            status: "available";
            contentHash: string;
            worksheetName: string;
            url: string;
        } | undefined;
        monteCarloResult?: {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    outputClassification: "confidential";
    contractId: "f7-analysis-result-v1";
    snapshot: {
        sessionId: string;
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        outputClassification: "confidential";
        contractId: "f7-analysis-result-v1";
        workbook: {
            fileName: string;
            workbookContentHash: string;
        };
        selectedWorksheetNames: string[];
        factors: {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }[];
        worksheetOptions: {
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
            worksheetName: string;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            selectionIndex: number;
        }[];
        systemSpecification?: {
            status: "available";
            designNominal: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            lowerSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            upperSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            targetSigmaLevel: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            additionalMeanShift: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
            designNominal?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            lowerSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            upperSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            targetSigmaLevel?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            additionalMeanShift?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | undefined;
        dimensionChainImage?: {
            status: "available";
            contentHash: string;
            worksheetName: string;
            url: string;
        } | undefined;
        monteCarloResult?: {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    };
}, {
    outputClassification: "confidential";
    contractId: "f7-analysis-result-v1";
    snapshot: {
        sessionId: string;
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        outputClassification: "confidential";
        contractId: "f7-analysis-result-v1";
        workbook: {
            fileName: string;
            workbookContentHash: string;
        };
        selectedWorksheetNames: string[];
        factors: {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                standardDeviation: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
            };
            input?: {
                mode: "MEASURED";
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                tolerance: number;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                upperTolerance: number;
                lowerTolerance: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                oneSigma: number;
                percentContributionToSigma: number;
                longTermSafetyFactor: number;
                designNominal: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sigmaLevel: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                factorId: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 0 | 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                } | {
                    minimum: number;
                    maximum: number;
                    standardDeviation: number;
                    samplerId: "UNIFORM_BOUNDED_V1";
                    physicalMean: number;
                    support: "BOUNDED_REAL";
                };
                calculatedMean: number;
                userAdded?: true | undefined;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            setup?: {
                confirmed: true;
                upperTolerance: number;
                lowerTolerance: number;
                designNominal: number;
                factorCandidateId: string;
                factorName?: string | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                userAdded?: true | undefined;
            } | undefined;
            datasetValidation?: {
                status: "blocked" | "ready";
                blockingIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    uniform: "eligible_with_boundary_warning";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                };
            } | undefined;
            measurementPasteResult?: {
                validation: {
                    status: "blocked" | "ready";
                    blockingIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "unit_mismatch" | "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        uniform: "eligible_with_boundary_warning";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                    };
                };
                status: "blocked" | "ready";
                factorId: string;
                dataset?: {
                    unit: string;
                    contentHash: string;
                    observations: ({
                        value: number;
                        disposition: "included";
                        originalRow: number;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    } | {
                        value: number;
                        confirmed: true;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        disposition: "excluded";
                        originalRow: number;
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    factorId: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    rationalSubgroupConfig?: {
                        subgroupSize: number;
                        estimator: "RANGE_D2" | "S_C4";
                    } | undefined;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                candidates: {
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                    modelSpecification: "normal_location_scale" | "lognormal_location_zero" | "lognormal_location_free" | "weibull_location_zero" | "weibull_location_free" | "gamma_location_zero" | "gamma_location_free" | "uniform_boundary_mle";
                    parameterCount: number;
                    parameters: Record<string, number>;
                    logLikelihood: number;
                    aic: number;
                    aicc: number;
                    bic: number;
                    deltaAicc: number;
                    deltaBic: number;
                    ks: number;
                    ad: number;
                    qqPoints: {
                        observed: number;
                        theoretical: number;
                    }[];
                    bootstrap: {
                        status: "rejected" | "acceptable" | "weak";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                            level: 0.95;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    };
                    warnings: string[];
                }[];
                factorId: string;
                sampleSize: number;
                characteristicKind: "other" | "dimensional";
                failedCandidates: {
                    reasonCode: "numerical_fit_failed";
                    family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                }[];
                sampleDiagnostics: {
                    mean: number;
                    median: number;
                    skewness: number;
                    coefficientOfVariation: number;
                    meanMedianRelativeDifference: number;
                    normalQqCurvature: number;
                };
                selectionDecision: {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "uniform" | "lognormal" | "weibull" | "gamma")[];
                    numericBestFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    engineeringDefaultFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                    proposedFinalFamily?: "normal" | "uniform" | "lognormal" | "weibull" | "gamma" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                approvedAt: string;
            } | undefined;
        }[];
        worksheetOptions: {
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
            worksheetName: string;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            selectionIndex: number;
        }[];
        systemSpecification?: {
            status: "available";
            designNominal: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            lowerSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            upperSpecLimit: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            targetSigmaLevel: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            additionalMeanShift: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            };
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | {
            status: "unavailable";
            reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid" | "legacy_artifact_missing_system_specification";
            designNominal?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            lowerSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            upperSpecLimit?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            targetSigmaLevel?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            additionalMeanShift?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
            volume?: {
                status: "available";
                actualValue: number;
                displayValue: string;
                sourceLabel: string;
                valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
                sourceCell?: string | undefined;
            } | {
                status: "unavailable";
                reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid";
                sourceCell?: string | undefined;
            } | undefined;
        } | undefined;
        dimensionChainImage?: {
            status: "available";
            contentHash: string;
            worksheetName: string;
            url: string;
        } | undefined;
        monteCarloResult?: {
            status: "complete";
            capability: {
                status: "available";
                cpk: number;
                targetCpk: number;
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                targetCpk: number;
                reason: "zero_variance";
            };
            mean: number;
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetSigmaLevel: number;
            yield: number;
            methodId: "F7_MONTE_CARLO_V1";
            iterations: 10000 | 100000;
            runSeed: string;
            correlationMode: "INDEPENDENT";
            quantiles: {
                p00135: number;
                p01: number;
                p05: number;
                p50: number;
                p95: number;
                p99: number;
                p99865: number;
            };
            inSpecCount: number;
            outOfSpecCount: number;
            outOfSpecProbability: number;
            ppm: number;
            histogram: {
                methodId: "F7_HISTOGRAM_FD_V1";
                bins: {
                    minimum: number;
                    maximum: number;
                    observedCount: number;
                }[];
            };
            normalFit: {
                mean: number;
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                expectedBinCounts: number[];
            };
            normalModel: {
                status: "available";
                totalDpm: number;
                lowerTailDpm: number;
                upperTailDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    };
}>;
export declare const f7WorkbookImportRouteRequestSchema: z.ZodObject<{
    fileName: z.ZodString;
    workbookBase64: z.ZodString;
}, "strict", z.ZodTypeAny, {
    fileName: string;
    workbookBase64: string;
}, {
    fileName: string;
    workbookBase64: string;
}>;
export declare const f7WorksheetConfirmRouteRequestSchema: z.ZodObject<{
    sessionId: z.ZodString;
    confirmation: z.ZodEffects<z.ZodObject<{
        workbookContentHash: z.ZodString;
        selectedWorksheetNames: z.ZodArray<z.ZodString, "many">;
        confirmed: z.ZodLiteral<true>;
    }, "strict", z.ZodTypeAny, {
        workbookContentHash: string;
        selectedWorksheetNames: string[];
        confirmed: true;
    }, {
        workbookContentHash: string;
        selectedWorksheetNames: string[];
        confirmed: true;
    }>, {
        workbookContentHash: string;
        selectedWorksheetNames: string[];
        confirmed: true;
    }, {
        workbookContentHash: string;
        selectedWorksheetNames: string[];
        confirmed: true;
    }>;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
    confirmation: {
        workbookContentHash: string;
        selectedWorksheetNames: string[];
        confirmed: true;
    };
}, {
    sessionId: string;
    confirmation: {
        workbookContentHash: string;
        selectedWorksheetNames: string[];
        confirmed: true;
    };
}>;
export declare const f7FactorConfirmRouteRequestSchema: z.ZodEffects<z.ZodObject<{
    sessionId: z.ZodString;
    confirmations: z.ZodArray<z.ZodEffects<z.ZodObject<{
        longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
        sigmaLevel: z.ZodOptional<z.ZodNumber>;
        distribution: z.ZodOptional<z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>>;
        confirmed: z.ZodLiteral<true>;
        designNominal: z.ZodNumber;
        upperTolerance: z.ZodNumber;
        lowerTolerance: z.ZodNumber;
        factorCandidateId: z.ZodString;
        factorName: z.ZodOptional<z.ZodString>;
        userAdded: z.ZodOptional<z.ZodLiteral<true>>;
    }, "strict", z.ZodTypeAny, {
        confirmed: true;
        upperTolerance: number;
        lowerTolerance: number;
        designNominal: number;
        factorCandidateId: string;
        factorName?: string | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        userAdded?: true | undefined;
    }, {
        confirmed: true;
        upperTolerance: number;
        lowerTolerance: number;
        designNominal: number;
        factorCandidateId: string;
        factorName?: string | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        userAdded?: true | undefined;
    }>, {
        confirmed: true;
        upperTolerance: number;
        lowerTolerance: number;
        designNominal: number;
        factorCandidateId: string;
        factorName?: string | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        userAdded?: true | undefined;
    }, {
        confirmed: true;
        upperTolerance: number;
        lowerTolerance: number;
        designNominal: number;
        factorCandidateId: string;
        factorName?: string | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        userAdded?: true | undefined;
    }>, "many">;
    systemSpecification: z.ZodOptional<z.ZodObject<{
        lowerSpecLimit: z.ZodNumber;
        upperSpecLimit: z.ZodNumber;
        targetSigmaLevel: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    }, {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    }>>;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
    confirmations: {
        confirmed: true;
        upperTolerance: number;
        lowerTolerance: number;
        designNominal: number;
        factorCandidateId: string;
        factorName?: string | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        userAdded?: true | undefined;
    }[];
    systemSpecification?: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    } | undefined;
}, {
    sessionId: string;
    confirmations: {
        confirmed: true;
        upperTolerance: number;
        lowerTolerance: number;
        designNominal: number;
        factorCandidateId: string;
        factorName?: string | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        userAdded?: true | undefined;
    }[];
    systemSpecification?: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    } | undefined;
}>, {
    sessionId: string;
    confirmations: {
        confirmed: true;
        upperTolerance: number;
        lowerTolerance: number;
        designNominal: number;
        factorCandidateId: string;
        factorName?: string | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        userAdded?: true | undefined;
    }[];
    systemSpecification?: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    } | undefined;
}, {
    sessionId: string;
    confirmations: {
        confirmed: true;
        upperTolerance: number;
        lowerTolerance: number;
        designNominal: number;
        factorCandidateId: string;
        factorName?: string | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        userAdded?: true | undefined;
    }[];
    systemSpecification?: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    } | undefined;
}>;
export declare const f7FactorModeRouteRequestSchema: z.ZodObject<{
    params: z.ZodObject<{
        factorId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        factorId: string;
    }, {
        factorId: string;
    }>;
    body: z.ZodObject<{
        sessionId: z.ZodString;
        mode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
        mode: "MEASURED" | "BASELINE_ASSUMPTION";
    }, {
        sessionId: string;
        mode: "MEASURED" | "BASELINE_ASSUMPTION";
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
        mode: "MEASURED" | "BASELINE_ASSUMPTION";
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
        mode: "MEASURED" | "BASELINE_ASSUMPTION";
    };
}>;
export declare const f7MeasurementPasteRouteRequestSchema: z.ZodObject<{
    params: z.ZodObject<{
        factorId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        factorId: string;
    }, {
        factorId: string;
    }>;
    body: z.ZodEffects<z.ZodObject<{
        sessionId: z.ZodString;
        structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
        rationalSubgroupConfig: z.ZodOptional<z.ZodObject<{
            subgroupSize: z.ZodNumber;
            estimator: z.ZodEnum<["RANGE_D2", "S_C4"]>;
        }, "strict", z.ZodTypeAny, {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        }, {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        }>>;
        sourceReference: z.ZodString;
        msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
        text: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
        text: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }, {
        sessionId: string;
        text: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }>, {
        sessionId: string;
        text: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }, {
        sessionId: string;
        text: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
        text: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
        text: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        rationalSubgroupConfig?: {
            subgroupSize: number;
            estimator: "RANGE_D2" | "S_C4";
        } | undefined;
    };
}>;
export declare const f7MeasurementDispositionRouteRequestSchema: z.ZodObject<{
    params: z.ZodObject<{
        factorId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        factorId: string;
    }, {
        factorId: string;
    }>;
    body: z.ZodObject<{
        sessionId: z.ZodString;
        rowNumbers: z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>;
        action: z.ZodEnum<["EXCLUDE", "RESTORE"]>;
        reason: z.ZodEnum<["OUTLIER", "MEASUREMENT_SYSTEM_ERROR", "TRANSCRIPTION_ERROR", "PROCESS_INTERRUPTION", "OTHER"]>;
        operatorReference: z.ZodString;
        confirmed: z.ZodLiteral<true>;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
        confirmed: true;
        action: "EXCLUDE" | "RESTORE";
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        rowNumbers: number[];
    }, {
        sessionId: string;
        confirmed: true;
        action: "EXCLUDE" | "RESTORE";
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        rowNumbers: number[];
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
        confirmed: true;
        action: "EXCLUDE" | "RESTORE";
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        rowNumbers: number[];
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
        confirmed: true;
        action: "EXCLUDE" | "RESTORE";
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        rowNumbers: number[];
    };
}>;
export declare const f7DistributionFitRouteRequestSchema: z.ZodObject<{
    params: z.ZodObject<{
        factorId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        factorId: string;
    }, {
        factorId: string;
    }>;
    body: z.ZodObject<{
        sessionId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
    }, {
        sessionId: string;
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
    };
}>;
export declare const f7DistributionApprovalRouteRequestSchema: z.ZodObject<{
    params: z.ZodObject<{
        factorId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        factorId: string;
    }, {
        factorId: string;
    }>;
    body: z.ZodObject<{
        sessionId: z.ZodString;
        family: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
        confirmed: z.ZodLiteral<true>;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
        confirmed: true;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }, {
        sessionId: string;
        confirmed: true;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
        confirmed: true;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        sessionId: string;
        confirmed: true;
        family: "normal" | "uniform" | "lognormal" | "weibull" | "gamma";
    };
}>;
export declare const f7MonteCarloRunRouteRequestSchema: z.ZodEffects<z.ZodObject<{
    body: z.ZodObject<{
        sessionId: z.ZodString;
        lowerSpecLimit: z.ZodNumber;
        upperSpecLimit: z.ZodNumber;
        targetSigmaLevel: z.ZodNumber;
        iterations: z.ZodUnion<[z.ZodLiteral<10000>, z.ZodLiteral<100000>]>;
        runSeed: z.ZodString;
        correlationMode: z.ZodLiteral<"INDEPENDENT">;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
    }, {
        sessionId: string;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
    }>;
}, "strict", z.ZodTypeAny, {
    body: {
        sessionId: string;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
    };
}, {
    body: {
        sessionId: string;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
    };
}>, {
    body: {
        sessionId: string;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
    };
}, {
    body: {
        sessionId: string;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
    };
}>;
export declare const f7ReportGenerateRouteRequestSchema: z.ZodObject<{
    body: z.ZodObject<{
        sessionId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
    }, {
        sessionId: string;
    }>;
}, "strict", z.ZodTypeAny, {
    body: {
        sessionId: string;
    };
}, {
    body: {
        sessionId: string;
    };
}>;
export declare const f7SessionRouteParamsSchema: z.ZodObject<{
    sessionId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
}, {
    sessionId: string;
}>;
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
    confirmWorksheet(request: {
        sessionId: string;
        confirmation: WorksheetSelectionConfirmation;
    }): F7SessionSnapshot;
    confirmFactorSetup(request: F7FactorConfirmRouteRequest): F7SessionSnapshot;
    setFactorMode(request: {
        sessionId: string;
        factorId: string;
        mode: F7FactorSourceMode;
    }): F7SessionSnapshot;
    pasteMeasurements(request: F7MeasurementPasteRequest & {
        sessionId: string;
    }): F7SessionSnapshot;
    applyMeasurementDisposition(request: F7MeasurementDispositionRequest & {
        sessionId: string;
    }): F7SessionSnapshot;
    fitDistribution(request: {
        sessionId: string;
        factorId: string;
    }): F7SessionSnapshot;
    approveDistribution(request: {
        sessionId: string;
        factorId: string;
        family: F7DistributionCandidateFamily;
        confirmed: true;
    }): F7SessionSnapshot;
    runMonteCarlo(request: F7MonteCarloRunRouteRequest["body"]): F7SessionSnapshot;
    generateReport(request: {
        sessionId: string;
    }): F7ReportProjection;
    getSession(sessionId: string): F7SessionSnapshot;
    readDimensionChainImage(sessionId: string): {
        readonly mediaType: "image/png" | "image/jpeg";
        readonly bytes: Uint8Array;
    };
}
//# sourceMappingURL=f7-contracts.d.ts.map