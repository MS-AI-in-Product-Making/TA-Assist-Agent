import { z } from "zod";
import type { WorksheetSelectionConfirmation } from "./contracts.js";
export declare const F7_SELECTION_NORMAL_SKEWNESS_MAX = 0.5;
export declare const F7_SELECTION_NORMAL_COEFFICIENT_OF_VARIATION_MAX = 0.1;
export declare const F7_SELECTION_NORMAL_MEAN_MEDIAN_RELATIVE_DIFFERENCE_MAX = 0.02;
export declare const F7_SELECTION_NORMAL_QQ_CURVATURE_MAX = 0.1;
export declare const f7LoopCoefficientSchema: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
export declare const f7FactorSourceModeSchema: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
export declare const f7MeasurementStructureSchema: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
export declare const f7MsaStatusSchema: z.ZodEnum<["available", "not_available", "unknown"]>;
export declare const f7ToleranceDistributionSchema: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
export declare const f7BaselineSamplerSchema: z.ZodObject<{
    samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
    physicalMean: z.ZodNumber;
    standardDeviation: z.ZodNumber;
    support: z.ZodLiteral<"REAL">;
}, "strict", z.ZodTypeAny, {
    samplerId: "NORMAL_LOCATION_SCALE_V1";
    physicalMean: number;
    standardDeviation: number;
    support: "REAL";
}, {
    samplerId: "NORMAL_LOCATION_SCALE_V1";
    physicalMean: number;
    standardDeviation: number;
    support: "REAL";
}>;
export declare const f7FactorCandidateSchema: z.ZodEffects<z.ZodObject<{
    longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
    sigmaLevel: z.ZodOptional<z.ZodNumber>;
    standardDeviation: z.ZodNumber;
    distribution: z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>;
    lowerSpecLimit: z.ZodNumber;
    upperSpecLimit: z.ZodNumber;
    designNominal: z.ZodEffects<z.ZodNumber, number, number>;
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
    standardDeviation: number;
    workbookContentHash: string;
    worksheetName: string;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    factorName: string;
    excelSignedMean: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    lowerSpecLimit: number;
    upperSpecLimit: number;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    userAdded?: true | undefined;
    workbookUnitEvidence?: string | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
}, {
    standardDeviation: number;
    workbookContentHash: string;
    worksheetName: string;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    factorName: string;
    excelSignedMean: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    lowerSpecLimit: number;
    upperSpecLimit: number;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    userAdded?: true | undefined;
    workbookUnitEvidence?: string | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
}>, {
    standardDeviation: number;
    workbookContentHash: string;
    worksheetName: string;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    factorName: string;
    excelSignedMean: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    lowerSpecLimit: number;
    upperSpecLimit: number;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    userAdded?: true | undefined;
    workbookUnitEvidence?: string | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
}, {
    standardDeviation: number;
    workbookContentHash: string;
    worksheetName: string;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    factorName: string;
    excelSignedMean: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    lowerSpecLimit: number;
    upperSpecLimit: number;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    userAdded?: true | undefined;
    workbookUnitEvidence?: string | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
}>;
export declare const f7FactorSetupConfirmationSchema: z.ZodEffects<z.ZodObject<{
    longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
    sigmaLevel: z.ZodOptional<z.ZodNumber>;
    distribution: z.ZodOptional<z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>>;
    confirmed: z.ZodLiteral<true>;
    designNominal: z.ZodEffects<z.ZodNumber, number, number>;
    upperTolerance: z.ZodNumber;
    lowerTolerance: z.ZodNumber;
    factorCandidateId: z.ZodString;
    factorName: z.ZodOptional<z.ZodString>;
    userAdded: z.ZodOptional<z.ZodLiteral<true>>;
}, "strict", z.ZodTypeAny, {
    factorCandidateId: string;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    confirmed: true;
    factorName?: string | undefined;
    userAdded?: true | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
}, {
    factorCandidateId: string;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    confirmed: true;
    factorName?: string | undefined;
    userAdded?: true | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
}>, {
    factorCandidateId: string;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    confirmed: true;
    factorName?: string | undefined;
    userAdded?: true | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
}, {
    factorCandidateId: string;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    confirmed: true;
    factorName?: string | undefined;
    userAdded?: true | undefined;
    longTermSafetyFactor?: number | undefined;
    sigmaLevel?: number | undefined;
    distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
}>;
export declare const f7UnitSourceSchema: z.ZodEnum<["workbook", "user_confirmed", "unspecified"]>;
export declare const f7FactorEvidenceSchema: z.ZodEffects<z.ZodObject<{
    loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
    physicalMean: z.ZodNumber;
    signedContributionMean: z.ZodNumber;
    baselineSampler: z.ZodObject<{
        samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
        physicalMean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        support: z.ZodLiteral<"REAL">;
    }, "strict", z.ZodTypeAny, {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    }, {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
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
    designNominal: z.ZodEffects<z.ZodNumber, number, number>;
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
    physicalMean: number;
    workbookContentHash: string;
    worksheetName: string;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    factorName: string;
    longTermSafetyFactor: number;
    sigmaLevel: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    lowerSpecLimit: number;
    upperSpecLimit: number;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    factorId: string;
    unit: string;
    unitSource: "workbook" | "user_confirmed" | "unspecified";
    loopCoefficient: 1 | -1;
    signedContributionMean: number;
    baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    };
    calculatedMean: number;
    tolerance: number;
    oneSigma: number;
    percentContributionToSigma: number;
    userAdded?: true | undefined;
}, {
    physicalMean: number;
    workbookContentHash: string;
    worksheetName: string;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    factorName: string;
    longTermSafetyFactor: number;
    sigmaLevel: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    lowerSpecLimit: number;
    upperSpecLimit: number;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    factorId: string;
    unit: string;
    unitSource: "workbook" | "user_confirmed" | "unspecified";
    loopCoefficient: 1 | -1;
    signedContributionMean: number;
    baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    };
    calculatedMean: number;
    tolerance: number;
    oneSigma: number;
    percentContributionToSigma: number;
    userAdded?: true | undefined;
}>, {
    physicalMean: number;
    workbookContentHash: string;
    worksheetName: string;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    factorName: string;
    longTermSafetyFactor: number;
    sigmaLevel: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    lowerSpecLimit: number;
    upperSpecLimit: number;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    factorId: string;
    unit: string;
    unitSource: "workbook" | "user_confirmed" | "unspecified";
    loopCoefficient: 1 | -1;
    signedContributionMean: number;
    baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    };
    calculatedMean: number;
    tolerance: number;
    oneSigma: number;
    percentContributionToSigma: number;
    userAdded?: true | undefined;
}, {
    physicalMean: number;
    workbookContentHash: string;
    worksheetName: string;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    factorName: string;
    longTermSafetyFactor: number;
    sigmaLevel: number;
    distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
    lowerSpecLimit: number;
    upperSpecLimit: number;
    designNominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    factorId: string;
    unit: string;
    unitSource: "workbook" | "user_confirmed" | "unspecified";
    loopCoefficient: 1 | -1;
    signedContributionMean: number;
    baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    };
    calculatedMean: number;
    tolerance: number;
    oneSigma: number;
    percentContributionToSigma: number;
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
    disposition: "excluded";
    originalRow: number;
    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
    operatorReference: string;
    sequence?: string | undefined;
    timestamp?: string | undefined;
    subgroup?: string | undefined;
    batch?: string | undefined;
}, {
    value: number;
    confirmed: true;
    disposition: "excluded";
    originalRow: number;
    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
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
        disposition: "excluded";
        originalRow: number;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    }, {
        value: number;
        confirmed: true;
        disposition: "excluded";
        originalRow: number;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
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
    factorId: string;
    unit: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    importedAt: string;
    msaStatus: "unknown" | "available" | "not_available";
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
        disposition: "excluded";
        originalRow: number;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    })[];
    missingRowCount: number;
    rejectionSummaries: {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }[];
    originalRowCount: number;
    analyzedCount: number;
    contentHash: string;
}, {
    factorId: string;
    unit: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    importedAt: string;
    msaStatus: "unknown" | "available" | "not_available";
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
        disposition: "excluded";
        originalRow: number;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    })[];
    missingRowCount: number;
    rejectionSummaries: {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }[];
    originalRowCount: number;
    analyzedCount: number;
    contentHash: string;
}>, {
    factorId: string;
    unit: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    importedAt: string;
    msaStatus: "unknown" | "available" | "not_available";
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
        disposition: "excluded";
        originalRow: number;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    })[];
    missingRowCount: number;
    rejectionSummaries: {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }[];
    originalRowCount: number;
    analyzedCount: number;
    contentHash: string;
}, {
    factorId: string;
    unit: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    importedAt: string;
    msaStatus: "unknown" | "available" | "not_available";
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
        disposition: "excluded";
        originalRow: number;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        sequence?: string | undefined;
        timestamp?: string | undefined;
        subgroup?: string | undefined;
        batch?: string | undefined;
    })[];
    missingRowCount: number;
    rejectionSummaries: {
        reason: "non_finite_value" | "invalid_row" | "missing_value";
        rowNumber: number;
    }[];
    originalRowCount: number;
    analyzedCount: number;
    contentHash: string;
}>;
export declare const f7FactorInputSchema: z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
    mode: z.ZodLiteral<"MEASURED">;
    dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        factorId: z.ZodString;
        unit: z.ZodString;
        structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }, {
            value: number;
            confirmed: true;
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
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
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    }, {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    }>, {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    }, {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    }>>;
}, "strict", z.ZodTypeAny, {
    mode: "MEASURED";
    dataset?: {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    } | undefined;
}, {
    mode: "MEASURED";
    dataset?: {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    } | undefined;
}>, z.ZodObject<{
    mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
    baselineSampler: z.ZodObject<{
        samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
        physicalMean: z.ZodNumber;
        standardDeviation: z.ZodNumber;
        support: z.ZodLiteral<"REAL">;
    }, "strict", z.ZodTypeAny, {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    }, {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    }>;
}, "strict", z.ZodTypeAny, {
    baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    };
    mode: "BASELINE_ASSUMPTION";
}, {
    baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        standardDeviation: number;
        support: "REAL";
    };
    mode: "BASELINE_ASSUMPTION";
}>]>;
export declare const f7DatasetValidationReasonSchema: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
export declare const f7DatasetValidationIssueReasonSchema: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
export declare const f7DatasetValidationIssueSchema: z.ZodObject<{
    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
    factorId: z.ZodOptional<z.ZodString>;
    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
}, "strict", z.ZodTypeAny, {
    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
    factorId?: string | undefined;
    rowNumbers?: number[] | undefined;
}, {
    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
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
    lognormal: "eligible" | "ineligible_nonpositive";
    weibull: "eligible" | "ineligible_nonpositive";
    gamma: "eligible" | "ineligible_nonpositive";
    uniform: "eligible_with_boundary_warning";
}, {
    normal: "eligible";
    lognormal: "eligible" | "ineligible_nonpositive";
    weibull: "eligible" | "ineligible_nonpositive";
    gamma: "eligible" | "ineligible_nonpositive";
    uniform: "eligible_with_boundary_warning";
}>;
export declare const f7DatasetValidationResultSchema: z.ZodObject<{
    status: z.ZodEnum<["ready", "blocked"]>;
    blockingIssues: z.ZodArray<z.ZodObject<{
        reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
        factorId: z.ZodOptional<z.ZodString>;
        rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
    }, "strict", z.ZodTypeAny, {
        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }, {
        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }>, "many">;
    advisoryIssues: z.ZodArray<z.ZodObject<{
        reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
        factorId: z.ZodOptional<z.ZodString>;
        rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
    }, "strict", z.ZodTypeAny, {
        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }, {
        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
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
        lognormal: "eligible" | "ineligible_nonpositive";
        weibull: "eligible" | "ineligible_nonpositive";
        gamma: "eligible" | "ineligible_nonpositive";
        uniform: "eligible_with_boundary_warning";
    }, {
        normal: "eligible";
        lognormal: "eligible" | "ineligible_nonpositive";
        weibull: "eligible" | "ineligible_nonpositive";
        gamma: "eligible" | "ineligible_nonpositive";
        uniform: "eligible_with_boundary_warning";
    }>;
}, "strict", z.ZodTypeAny, {
    status: "ready" | "blocked";
    blockingIssues: {
        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }[];
    advisoryIssues: {
        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }[];
    candidateEligibility: {
        normal: "eligible";
        lognormal: "eligible" | "ineligible_nonpositive";
        weibull: "eligible" | "ineligible_nonpositive";
        gamma: "eligible" | "ineligible_nonpositive";
        uniform: "eligible_with_boundary_warning";
    };
}, {
    status: "ready" | "blocked";
    blockingIssues: {
        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }[];
    advisoryIssues: {
        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
        factorId?: string | undefined;
        rowNumbers?: number[] | undefined;
    }[];
    candidateEligibility: {
        normal: "eligible";
        lognormal: "eligible" | "ineligible_nonpositive";
        weibull: "eligible" | "ineligible_nonpositive";
        gamma: "eligible" | "ineligible_nonpositive";
        uniform: "eligible_with_boundary_warning";
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
        level: 0.95;
        method: "wilson_score";
        lower: number;
        upper: number;
    }, {
        level: 0.95;
        method: "wilson_score";
        lower: number;
        upper: number;
    }>, {
        level: 0.95;
        method: "wilson_score";
        lower: number;
        upper: number;
    }, {
        level: 0.95;
        method: "wilson_score";
        lower: number;
        upper: number;
    }>;
    pValue: z.ZodNumber;
    replicates: z.ZodLiteral<10000>;
    seed: z.ZodString;
    methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
    candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
    streamDigest: z.ZodString;
    status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
}, "strict", z.ZodTypeAny, {
    status: "acceptable" | "weak" | "rejected";
    statisticId: "anderson_darling";
    observedStatistic: number;
    comparisonDirection: "greater_than_or_equal";
    refitEachReplicate: true;
    extremeReplicateCount: number;
    confidenceInterval: {
        level: 0.95;
        method: "wilson_score";
        lower: number;
        upper: number;
    };
    pValue: number;
    replicates: 10000;
    seed: string;
    methodId: "F7_BOOTSTRAP_V2";
    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
    streamDigest: string;
}, {
    status: "acceptable" | "weak" | "rejected";
    statisticId: "anderson_darling";
    observedStatistic: number;
    comparisonDirection: "greater_than_or_equal";
    refitEachReplicate: true;
    extremeReplicateCount: number;
    confidenceInterval: {
        level: 0.95;
        method: "wilson_score";
        lower: number;
        upper: number;
    };
    pValue: number;
    replicates: 10000;
    seed: string;
    methodId: "F7_BOOTSTRAP_V2";
    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
    streamDigest: string;
}>, {
    status: "acceptable" | "weak" | "rejected";
    statisticId: "anderson_darling";
    observedStatistic: number;
    comparisonDirection: "greater_than_or_equal";
    refitEachReplicate: true;
    extremeReplicateCount: number;
    confidenceInterval: {
        level: 0.95;
        method: "wilson_score";
        lower: number;
        upper: number;
    };
    pValue: number;
    replicates: 10000;
    seed: string;
    methodId: "F7_BOOTSTRAP_V2";
    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
    streamDigest: string;
}, {
    status: "acceptable" | "weak" | "rejected";
    statisticId: "anderson_darling";
    observedStatistic: number;
    comparisonDirection: "greater_than_or_equal";
    refitEachReplicate: true;
    extremeReplicateCount: number;
    confidenceInterval: {
        level: 0.95;
        method: "wilson_score";
        lower: number;
        upper: number;
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
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
        }, {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
        }>, {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
        }, {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
        }>;
        pValue: z.ZodNumber;
        replicates: z.ZodLiteral<10000>;
        seed: z.ZodString;
        methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
        candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
        streamDigest: z.ZodString;
        status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
    }, "strict", z.ZodTypeAny, {
        status: "acceptable" | "weak" | "rejected";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    }, {
        status: "acceptable" | "weak" | "rejected";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    }>, {
        status: "acceptable" | "weak" | "rejected";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
        };
        pValue: number;
        replicates: 10000;
        seed: string;
        methodId: "F7_BOOTSTRAP_V2";
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
        streamDigest: string;
    }, {
        status: "acceptable" | "weak" | "rejected";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
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
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        status: "acceptable" | "weak" | "rejected";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
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
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        status: "acceptable" | "weak" | "rejected";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
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
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        status: "acceptable" | "weak" | "rejected";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
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
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        status: "acceptable" | "weak" | "rejected";
        statisticId: "anderson_darling";
        observedStatistic: number;
        comparisonDirection: "greater_than_or_equal";
        refitEachReplicate: true;
        extremeReplicateCount: number;
        confidenceInterval: {
            level: 0.95;
            method: "wilson_score";
            lower: number;
            upper: number;
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
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
    reasonCode: "numerical_fit_failed";
}, {
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
    reasonCode: "numerical_fit_failed";
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
    methodId: "F7_MODEL_SELECTION_V1";
    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
    confidence: "low" | "moderate";
    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
}, {
    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
    methodId: "F7_MODEL_SELECTION_V1";
    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
    confidence: "low" | "moderate";
    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
}>, {
    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
    methodId: "F7_MODEL_SELECTION_V1";
    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
    confidence: "low" | "moderate";
    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
}, {
    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
    methodId: "F7_MODEL_SELECTION_V1";
    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
    confidence: "low" | "moderate";
    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
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
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
            }, {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
            }>, {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
            }, {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
            }>;
            pValue: z.ZodNumber;
            replicates: z.ZodLiteral<10000>;
            seed: z.ZodString;
            methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
            candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
            streamDigest: z.ZodString;
            status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
        }, "strict", z.ZodTypeAny, {
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        }, {
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        }>, {
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
            };
            pValue: number;
            replicates: 10000;
            seed: string;
            methodId: "F7_BOOTSTRAP_V2";
            candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
            streamDigest: string;
        }, {
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        reasonCode: "numerical_fit_failed";
    }, {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        reasonCode: "numerical_fit_failed";
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
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    }, {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    }>, {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    }, {
        status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    factorId: string;
    sampleSize: number;
    characteristicKind: "dimensional" | "other";
    candidates: {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
    failedCandidates: {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        reasonCode: "numerical_fit_failed";
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
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    };
}, {
    factorId: string;
    sampleSize: number;
    characteristicKind: "dimensional" | "other";
    candidates: {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
    failedCandidates: {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        reasonCode: "numerical_fit_failed";
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
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    };
}>, {
    factorId: string;
    sampleSize: number;
    characteristicKind: "dimensional" | "other";
    candidates: {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
    failedCandidates: {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        reasonCode: "numerical_fit_failed";
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
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    };
}, {
    factorId: string;
    sampleSize: number;
    characteristicKind: "dimensional" | "other";
    candidates: {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            status: "acceptable" | "weak" | "rejected";
            statisticId: "anderson_darling";
            observedStatistic: number;
            comparisonDirection: "greater_than_or_equal";
            refitEachReplicate: true;
            extremeReplicateCount: number;
            confidenceInterval: {
                level: 0.95;
                method: "wilson_score";
                lower: number;
                upper: number;
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
    failedCandidates: {
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        reasonCode: "numerical_fit_failed";
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
        methodId: "F7_MODEL_SELECTION_V1";
        competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
        confidence: "low" | "moderate";
        reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
        numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
        proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
    };
}>;
export declare const f7MeasurementPasteResultSchema: z.ZodObject<{
    status: z.ZodEnum<["ready", "blocked"]>;
    factorId: z.ZodString;
    dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        factorId: z.ZodString;
        unit: z.ZodString;
        structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        }, {
            value: number;
            confirmed: true;
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
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
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    }, {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    }>, {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    }, {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    }>>;
    validation: z.ZodObject<{
        status: z.ZodEnum<["ready", "blocked"]>;
        blockingIssues: z.ZodArray<z.ZodObject<{
            reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
            factorId: z.ZodOptional<z.ZodString>;
            rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
        }, "strict", z.ZodTypeAny, {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }, {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }>, "many">;
        advisoryIssues: z.ZodArray<z.ZodObject<{
            reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
            factorId: z.ZodOptional<z.ZodString>;
            rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
        }, "strict", z.ZodTypeAny, {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }, {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
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
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
            uniform: "eligible_with_boundary_warning";
        }, {
            normal: "eligible";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
            uniform: "eligible_with_boundary_warning";
        }>;
    }, "strict", z.ZodTypeAny, {
        status: "ready" | "blocked";
        blockingIssues: {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        advisoryIssues: {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        candidateEligibility: {
            normal: "eligible";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
            uniform: "eligible_with_boundary_warning";
        };
    }, {
        status: "ready" | "blocked";
        blockingIssues: {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        advisoryIssues: {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        candidateEligibility: {
            normal: "eligible";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
            uniform: "eligible_with_boundary_warning";
        };
    }>;
}, "strict", z.ZodTypeAny, {
    status: "ready" | "blocked";
    validation: {
        status: "ready" | "blocked";
        blockingIssues: {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        advisoryIssues: {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        candidateEligibility: {
            normal: "eligible";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
            uniform: "eligible_with_boundary_warning";
        };
    };
    factorId: string;
    dataset?: {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
    } | undefined;
}, {
    status: "ready" | "blocked";
    validation: {
        status: "ready" | "blocked";
        blockingIssues: {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        advisoryIssues: {
            reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
            factorId?: string | undefined;
            rowNumbers?: number[] | undefined;
        }[];
        candidateEligibility: {
            normal: "eligible";
            lognormal: "eligible" | "ineligible_nonpositive";
            weibull: "eligible" | "ineligible_nonpositive";
            gamma: "eligible" | "ineligible_nonpositive";
            uniform: "eligible_with_boundary_warning";
        };
    };
    factorId: string;
    dataset?: {
        factorId: string;
        unit: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        importedAt: string;
        msaStatus: "unknown" | "available" | "not_available";
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
            disposition: "excluded";
            originalRow: number;
            reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
            operatorReference: string;
            sequence?: string | undefined;
            timestamp?: string | undefined;
            subgroup?: string | undefined;
            batch?: string | undefined;
        })[];
        missingRowCount: number;
        rejectionSummaries: {
            reason: "non_finite_value" | "invalid_row" | "missing_value";
            rowNumber: number;
        }[];
        originalRowCount: number;
        analyzedCount: number;
        contentHash: string;
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
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
    approvedAt: string;
}, {
    confirmed: true;
    factorId: string;
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
    sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
}, {
    factorId: string;
    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        mean: number;
        expectedBinCounts: number[];
    }, {
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        mean: number;
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
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        cpk: number;
        targetCpk: number;
        targetStatus: "meets_target" | "below_target";
    }, {
        status: "available";
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        cpk: number;
        targetCpk: number;
        targetStatus: "meets_target" | "below_target";
    }>, z.ZodObject<{
        status: z.ZodLiteral<"not_available">;
        reason: z.ZodLiteral<"zero_variance">;
        targetCpk: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        status: "not_available";
        reason: "zero_variance";
        targetCpk: number;
    }, {
        status: "not_available";
        reason: "zero_variance";
        targetCpk: number;
    }>]>;
    normalModel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
        status: z.ZodLiteral<"available">;
        lowerTailDpm: z.ZodNumber;
        upperTailDpm: z.ZodNumber;
        totalDpm: z.ZodNumber;
        expectedYield: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        status: "available";
        lowerTailDpm: number;
        upperTailDpm: number;
        totalDpm: number;
        expectedYield: number;
    }, {
        status: "available";
        lowerTailDpm: number;
        upperTailDpm: number;
        totalDpm: number;
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
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }, {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    status: "complete";
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    methodId: "F7_MONTE_CARLO_V1";
    mean: number;
    targetSigmaLevel: number;
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
    yield: number;
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
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        mean: number;
        expectedBinCounts: number[];
    };
    capability: {
        status: "available";
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        cpk: number;
        targetCpk: number;
        targetStatus: "meets_target" | "below_target";
    } | {
        status: "not_available";
        reason: "zero_variance";
        targetCpk: number;
    };
    normalModel: {
        status: "available";
        lowerTailDpm: number;
        upperTailDpm: number;
        totalDpm: number;
        expectedYield: number;
    } | {
        status: "not_available";
        reason: "zero_variance";
    };
    factorManifest: {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
}, {
    status: "complete";
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    methodId: "F7_MONTE_CARLO_V1";
    mean: number;
    targetSigmaLevel: number;
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
    yield: number;
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
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        mean: number;
        expectedBinCounts: number[];
    };
    capability: {
        status: "available";
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        cpk: number;
        targetCpk: number;
        targetStatus: "meets_target" | "below_target";
    } | {
        status: "not_available";
        reason: "zero_variance";
        targetCpk: number;
    };
    normalModel: {
        status: "available";
        lowerTailDpm: number;
        upperTailDpm: number;
        totalDpm: number;
        expectedYield: number;
    } | {
        status: "not_available";
        reason: "zero_variance";
    };
    factorManifest: {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
}>, {
    status: "complete";
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    methodId: "F7_MONTE_CARLO_V1";
    mean: number;
    targetSigmaLevel: number;
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
    yield: number;
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
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        mean: number;
        expectedBinCounts: number[];
    };
    capability: {
        status: "available";
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        cpk: number;
        targetCpk: number;
        targetStatus: "meets_target" | "below_target";
    } | {
        status: "not_available";
        reason: "zero_variance";
        targetCpk: number;
    };
    normalModel: {
        status: "available";
        lowerTailDpm: number;
        upperTailDpm: number;
        totalDpm: number;
        expectedYield: number;
    } | {
        status: "not_available";
        reason: "zero_variance";
    };
    factorManifest: {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
}, {
    status: "complete";
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    methodId: "F7_MONTE_CARLO_V1";
    mean: number;
    targetSigmaLevel: number;
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
    yield: number;
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
        standardDeviation: number;
        methodId: "F7_NORMAL_MOMENT_FIT_V1";
        mean: number;
        expectedBinCounts: number[];
    };
    capability: {
        status: "available";
        cp: number;
        lowerCpk: number;
        upperCpk: number;
        cpk: number;
        targetCpk: number;
        targetStatus: "meets_target" | "below_target";
    } | {
        status: "not_available";
        reason: "zero_variance";
        targetCpk: number;
    };
    normalModel: {
        status: "available";
        lowerTailDpm: number;
        upperTailDpm: number;
        totalDpm: number;
        expectedYield: number;
    } | {
        status: "not_available";
        reason: "zero_variance";
    };
    factorManifest: {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }[];
}>;
export declare const f7ReportAssessmentSchema: z.ZodEnum<["MEETS_TARGET", "BELOW_TARGET", "NOT_EVALUABLE"]>;
export declare const f7ReportWorkbookSchema: z.ZodObject<{
    fileName: z.ZodString;
    workbookContentHash: z.ZodString;
    worksheetName: z.ZodString;
}, "strict", z.ZodTypeAny, {
    workbookContentHash: string;
    worksheetName: string;
    fileName: string;
}, {
    workbookContentHash: string;
    worksheetName: string;
    fileName: string;
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
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    mean: number;
    targetSigmaLevel: number;
    yield: number;
    ppm: number;
    targetCpk: number;
    cp?: number | undefined;
    cpk?: number | undefined;
}, {
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    mean: number;
    targetSigmaLevel: number;
    yield: number;
    ppm: number;
    targetCpk: number;
    cp?: number | undefined;
    cpk?: number | undefined;
}>, {
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    mean: number;
    targetSigmaLevel: number;
    yield: number;
    ppm: number;
    targetCpk: number;
    cp?: number | undefined;
    cpk?: number | undefined;
}, {
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    mean: number;
    targetSigmaLevel: number;
    yield: number;
    ppm: number;
    targetCpk: number;
    cp?: number | undefined;
    cpk?: number | undefined;
}>;
export declare const f7ReportFactorSchema: z.ZodObject<{
    factorId: z.ZodString;
    factorName: z.ZodString;
    loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
    sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
    approvedDistribution: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
    sourceReferences: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    factorName: string;
    factorId: string;
    loopCoefficient: 1 | -1;
    sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    approvedDistribution: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
    sourceReferences: string[];
}, {
    factorName: string;
    factorId: string;
    loopCoefficient: 1 | -1;
    sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    approvedDistribution: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
    sourceReferences: string[];
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
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }, {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    workbookContentHash: string;
    worksheetName: string;
    seed: string;
    iterations: 10000 | 100000;
    factorManifest: {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    workbookContentHash: string;
    worksheetName: string;
    seed: string;
    iterations: 10000 | 100000;
    factorManifest: {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    workbookContentHash: string;
    worksheetName: string;
    seed: string;
    iterations: 10000 | 100000;
    factorManifest: {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    workbookContentHash: string;
    worksheetName: string;
    seed: string;
    iterations: 10000 | 100000;
    factorManifest: {
        factorId: string;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        workbookContentHash: string;
        worksheetName: string;
        fileName: string;
    }, {
        workbookContentHash: string;
        worksheetName: string;
        fileName: string;
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
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        mean: number;
        targetSigmaLevel: number;
        yield: number;
        ppm: number;
        targetCpk: number;
        cp?: number | undefined;
        cpk?: number | undefined;
    }, {
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        mean: number;
        targetSigmaLevel: number;
        yield: number;
        ppm: number;
        targetCpk: number;
        cp?: number | undefined;
        cpk?: number | undefined;
    }>, {
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        mean: number;
        targetSigmaLevel: number;
        yield: number;
        ppm: number;
        targetCpk: number;
        cp?: number | undefined;
        cpk?: number | undefined;
    }, {
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        mean: number;
        targetSigmaLevel: number;
        yield: number;
        ppm: number;
        targetCpk: number;
        cp?: number | undefined;
        cpk?: number | undefined;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        }, {
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
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
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        }, {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        }>, z.ZodObject<{
            status: z.ZodLiteral<"not_available">;
            reason: z.ZodLiteral<"zero_variance">;
            targetCpk: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        }, {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        }>]>;
        normalModel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            lowerTailDpm: z.ZodNumber;
            upperTailDpm: z.ZodNumber;
            totalDpm: z.ZodNumber;
            expectedYield: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        }, {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
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
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }, {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }, {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }>, {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }, {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }>;
    factors: z.ZodArray<z.ZodObject<{
        factorId: z.ZodString;
        factorName: z.ZodString;
        loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
        sourceMode: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
        approvedDistribution: z.ZodEnum<["normal", "lognormal", "weibull", "gamma", "uniform"]>;
        sourceReferences: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        factorName: string;
        factorId: string;
        loopCoefficient: 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceReferences: string[];
    }, {
        factorName: string;
        factorId: string;
        loopCoefficient: 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceReferences: string[];
    }>, "many">;
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
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }, {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        workbookContentHash: string;
        worksheetName: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        workbookContentHash: string;
        worksheetName: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        workbookContentHash: string;
        worksheetName: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        workbookContentHash: string;
        worksheetName: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    workbook: {
        workbookContentHash: string;
        worksheetName: string;
        fileName: string;
    };
    simulation: {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    };
    contractId: "f7-report-v1";
    outputClassification: "confidential";
    sessionId: string;
    generatedAt: string;
    assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
    summary: {
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        mean: number;
        targetSigmaLevel: number;
        yield: number;
        ppm: number;
        targetCpk: number;
        cp?: number | undefined;
        cpk?: number | undefined;
    };
    factors: {
        factorName: string;
        factorId: string;
        loopCoefficient: 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceReferences: string[];
    }[];
    evidence: {
        workbookContentHash: string;
        worksheetName: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    markdown: string;
}, {
    workbook: {
        workbookContentHash: string;
        worksheetName: string;
        fileName: string;
    };
    simulation: {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    };
    contractId: "f7-report-v1";
    outputClassification: "confidential";
    sessionId: string;
    generatedAt: string;
    assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
    summary: {
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        mean: number;
        targetSigmaLevel: number;
        yield: number;
        ppm: number;
        targetCpk: number;
        cp?: number | undefined;
        cpk?: number | undefined;
    };
    factors: {
        factorName: string;
        factorId: string;
        loopCoefficient: 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceReferences: string[];
    }[];
    evidence: {
        workbookContentHash: string;
        worksheetName: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    markdown: string;
}>, {
    workbook: {
        workbookContentHash: string;
        worksheetName: string;
        fileName: string;
    };
    simulation: {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    };
    contractId: "f7-report-v1";
    outputClassification: "confidential";
    sessionId: string;
    generatedAt: string;
    assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
    summary: {
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        mean: number;
        targetSigmaLevel: number;
        yield: number;
        ppm: number;
        targetCpk: number;
        cp?: number | undefined;
        cpk?: number | undefined;
    };
    factors: {
        factorName: string;
        factorId: string;
        loopCoefficient: 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceReferences: string[];
    }[];
    evidence: {
        workbookContentHash: string;
        worksheetName: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    markdown: string;
}, {
    workbook: {
        workbookContentHash: string;
        worksheetName: string;
        fileName: string;
    };
    simulation: {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    };
    contractId: "f7-report-v1";
    outputClassification: "confidential";
    sessionId: string;
    generatedAt: string;
    assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
    summary: {
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        mean: number;
        targetSigmaLevel: number;
        yield: number;
        ppm: number;
        targetCpk: number;
        cp?: number | undefined;
        cpk?: number | undefined;
    };
    factors: {
        factorName: string;
        factorId: string;
        loopCoefficient: 1 | -1;
        sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        approvedDistribution: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sourceReferences: string[];
    }[];
    evidence: {
        workbookContentHash: string;
        worksheetName: string;
        seed: string;
        iterations: 10000 | 100000;
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    markdown: string;
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
    worksheetName: string;
    selectionIndex: number;
    toleranceLoopDescription: string;
    worksheetKind: "analysis" | "example_or_template";
    source: {
        summarySheet: "Auto Summary";
        summaryRow: number;
        worksheetAnchor: string;
    } | {
        worksheetAnchor: string;
        discoveryMethod: "worksheet_scan";
        descriptionCell: string;
    };
}, {
    worksheetName: string;
    selectionIndex: number;
    toleranceLoopDescription: string;
    worksheetKind: "analysis" | "example_or_template";
    source: {
        summarySheet: "Auto Summary";
        summaryRow: number;
        worksheetAnchor: string;
    } | {
        worksheetAnchor: string;
        discoveryMethod: "worksheet_scan";
        descriptionCell: string;
    };
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
        workbookContentHash: string;
        fileName: string;
    }, {
        workbookContentHash: string;
        fileName: string;
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
        worksheetName: string;
        selectionIndex: number;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
    }, {
        worksheetName: string;
        selectionIndex: number;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
    }>, "many">;
    systemSpecification: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
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
            designNominal: z.ZodEffects<z.ZodNumber, number, number>;
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
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        }, {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        }>, {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        }, {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        }>;
        setup: z.ZodOptional<z.ZodEffects<z.ZodObject<{
            longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
            sigmaLevel: z.ZodOptional<z.ZodNumber>;
            distribution: z.ZodOptional<z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>>;
            confirmed: z.ZodLiteral<true>;
            designNominal: z.ZodEffects<z.ZodNumber, number, number>;
            upperTolerance: z.ZodNumber;
            lowerTolerance: z.ZodNumber;
            factorCandidateId: z.ZodString;
            factorName: z.ZodOptional<z.ZodString>;
            userAdded: z.ZodOptional<z.ZodLiteral<true>>;
        }, "strict", z.ZodTypeAny, {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        }, {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        }>, {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        }, {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        }>>;
        sourceMode: z.ZodOptional<z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>>;
        input: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
            mode: z.ZodLiteral<"MEASURED">;
            dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                factorId: z.ZodString;
                unit: z.ZodString;
                structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }, {
                    value: number;
                    confirmed: true;
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
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
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            }, {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            }>, {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            }, {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            }>>;
        }, "strict", z.ZodTypeAny, {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        }, {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        }>, z.ZodObject<{
            mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
            baselineSampler: z.ZodObject<{
                samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
                physicalMean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                support: z.ZodLiteral<"REAL">;
            }, "strict", z.ZodTypeAny, {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            }, {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            }>;
        }, "strict", z.ZodTypeAny, {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        }, {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        }>]>>;
        evidence: z.ZodOptional<z.ZodEffects<z.ZodObject<{
            loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
            physicalMean: z.ZodNumber;
            signedContributionMean: z.ZodNumber;
            baselineSampler: z.ZodObject<{
                samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
                physicalMean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                support: z.ZodLiteral<"REAL">;
            }, "strict", z.ZodTypeAny, {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            }, {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
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
            designNominal: z.ZodEffects<z.ZodNumber, number, number>;
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
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        }, {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        }>, {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        }, {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        }>>;
        datasetValidation: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<["ready", "blocked"]>;
            blockingIssues: z.ZodArray<z.ZodObject<{
                reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                factorId: z.ZodOptional<z.ZodString>;
                rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
            }, "strict", z.ZodTypeAny, {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }, {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }>, "many">;
            advisoryIssues: z.ZodArray<z.ZodObject<{
                reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                factorId: z.ZodOptional<z.ZodString>;
                rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
            }, "strict", z.ZodTypeAny, {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }, {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
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
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            }, {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            }>;
        }, "strict", z.ZodTypeAny, {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        }, {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        }>>;
        measurementPasteResult: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<["ready", "blocked"]>;
            factorId: z.ZodString;
            dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                factorId: z.ZodString;
                unit: z.ZodString;
                structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                }, {
                    value: number;
                    confirmed: true;
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
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
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            }, {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            }>, {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            }, {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            }>>;
            validation: z.ZodObject<{
                status: z.ZodEnum<["ready", "blocked"]>;
                blockingIssues: z.ZodArray<z.ZodObject<{
                    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                    factorId: z.ZodOptional<z.ZodString>;
                    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                }, "strict", z.ZodTypeAny, {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }, {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }>, "many">;
                advisoryIssues: z.ZodArray<z.ZodObject<{
                    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                    factorId: z.ZodOptional<z.ZodString>;
                    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                }, "strict", z.ZodTypeAny, {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }, {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
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
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                }, {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                }>;
            }, "strict", z.ZodTypeAny, {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            }, {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            }>;
        }, "strict", z.ZodTypeAny, {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        }, {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
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
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                    }, {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                    }>, {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                    }, {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                    }>;
                    pValue: z.ZodNumber;
                    replicates: z.ZodLiteral<10000>;
                    seed: z.ZodString;
                    methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
                    candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
                    streamDigest: z.ZodString;
                    status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
                }, "strict", z.ZodTypeAny, {
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                }, {
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                }>, {
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
                    };
                    pValue: number;
                    replicates: 10000;
                    seed: string;
                    methodId: "F7_BOOTSTRAP_V2";
                    candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                    streamDigest: string;
                }, {
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
            }, {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            }, {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            }>, {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            }, {
                status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            }>;
        }, "strict", z.ZodTypeAny, {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        }, {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        }>, {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        }, {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
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
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        }, {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        }>>;
    }, "strict", z.ZodTypeAny, {
        factorCandidate: {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        };
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        evidence?: {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        } | undefined;
        setup?: {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        } | undefined;
        input?: {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        } | undefined;
        datasetValidation?: {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        } | undefined;
        measurementPasteResult?: {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        } | undefined;
    }, {
        factorCandidate: {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        };
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        evidence?: {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        } | undefined;
        setup?: {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        } | undefined;
        input?: {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        } | undefined;
        datasetValidation?: {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        } | undefined;
        measurementPasteResult?: {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        } | undefined;
    }>, {
        factorCandidate: {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        };
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        evidence?: {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        } | undefined;
        setup?: {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        } | undefined;
        input?: {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        } | undefined;
        datasetValidation?: {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        } | undefined;
        measurementPasteResult?: {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        } | undefined;
    }, {
        factorCandidate: {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        };
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        evidence?: {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        } | undefined;
        setup?: {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        } | undefined;
        input?: {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        } | undefined;
        datasetValidation?: {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        } | undefined;
        measurementPasteResult?: {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        }, {
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
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
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        }, {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        }>, z.ZodObject<{
            status: z.ZodLiteral<"not_available">;
            reason: z.ZodLiteral<"zero_variance">;
            targetCpk: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        }, {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        }>]>;
        normalModel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
            status: z.ZodLiteral<"available">;
            lowerTailDpm: z.ZodNumber;
            upperTailDpm: z.ZodNumber;
            totalDpm: z.ZodNumber;
            expectedYield: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        }, {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
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
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }, {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }, {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }>, {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }, {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    }>>;
}, "strict", z.ZodTypeAny, {
    status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
    workbook: {
        workbookContentHash: string;
        fileName: string;
    };
    contractId: "f7-analysis-result-v1";
    outputClassification: "confidential";
    sessionId: string;
    factors: {
        factorCandidate: {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        };
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        evidence?: {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        } | undefined;
        setup?: {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        } | undefined;
        input?: {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        } | undefined;
        datasetValidation?: {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        } | undefined;
        measurementPasteResult?: {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        } | undefined;
    }[];
    selectedWorksheetNames: string[];
    worksheetOptions: {
        worksheetName: string;
        selectionIndex: number;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
    }[];
    systemSpecification?: {
        status: "available";
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
    monteCarloResult?: {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    } | undefined;
}, {
    status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
    workbook: {
        workbookContentHash: string;
        fileName: string;
    };
    contractId: "f7-analysis-result-v1";
    outputClassification: "confidential";
    sessionId: string;
    factors: {
        factorCandidate: {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        };
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        evidence?: {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        } | undefined;
        setup?: {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        } | undefined;
        input?: {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        } | undefined;
        datasetValidation?: {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        } | undefined;
        measurementPasteResult?: {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        } | undefined;
    }[];
    selectedWorksheetNames: string[];
    worksheetOptions: {
        worksheetName: string;
        selectionIndex: number;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
    }[];
    systemSpecification?: {
        status: "available";
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
    monteCarloResult?: {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    } | undefined;
}>, {
    status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
    workbook: {
        workbookContentHash: string;
        fileName: string;
    };
    contractId: "f7-analysis-result-v1";
    outputClassification: "confidential";
    sessionId: string;
    factors: {
        factorCandidate: {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        };
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        evidence?: {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        } | undefined;
        setup?: {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        } | undefined;
        input?: {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        } | undefined;
        datasetValidation?: {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        } | undefined;
        measurementPasteResult?: {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        } | undefined;
    }[];
    selectedWorksheetNames: string[];
    worksheetOptions: {
        worksheetName: string;
        selectionIndex: number;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
    }[];
    systemSpecification?: {
        status: "available";
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
    monteCarloResult?: {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
        }[];
    } | undefined;
}, {
    status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
    workbook: {
        workbookContentHash: string;
        fileName: string;
    };
    contractId: "f7-analysis-result-v1";
    outputClassification: "confidential";
    sessionId: string;
    factors: {
        factorCandidate: {
            standardDeviation: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            excelSignedMean: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            userAdded?: true | undefined;
            workbookUnitEvidence?: string | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
        };
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
        evidence?: {
            physicalMean: number;
            workbookContentHash: string;
            worksheetName: string;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            factorName: string;
            longTermSafetyFactor: number;
            sigmaLevel: number;
            distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
            lowerSpecLimit: number;
            upperSpecLimit: number;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            factorId: string;
            unit: string;
            unitSource: "workbook" | "user_confirmed" | "unspecified";
            loopCoefficient: 1 | -1;
            signedContributionMean: number;
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            calculatedMean: number;
            tolerance: number;
            oneSigma: number;
            percentContributionToSigma: number;
            userAdded?: true | undefined;
        } | undefined;
        setup?: {
            factorCandidateId: string;
            designNominal: number;
            upperTolerance: number;
            lowerTolerance: number;
            confirmed: true;
            factorName?: string | undefined;
            userAdded?: true | undefined;
            longTermSafetyFactor?: number | undefined;
            sigmaLevel?: number | undefined;
            distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
        } | undefined;
        input?: {
            mode: "MEASURED";
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | {
            baselineSampler: {
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                standardDeviation: number;
                support: "REAL";
            };
            mode: "BASELINE_ASSUMPTION";
        } | undefined;
        datasetValidation?: {
            status: "ready" | "blocked";
            blockingIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            advisoryIssues: {
                reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                factorId?: string | undefined;
                rowNumbers?: number[] | undefined;
            }[];
            candidateEligibility: {
                normal: "eligible";
                lognormal: "eligible" | "ineligible_nonpositive";
                weibull: "eligible" | "ineligible_nonpositive";
                gamma: "eligible" | "ineligible_nonpositive";
                uniform: "eligible_with_boundary_warning";
            };
        } | undefined;
        measurementPasteResult?: {
            status: "ready" | "blocked";
            validation: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            };
            factorId: string;
            dataset?: {
                factorId: string;
                unit: string;
                structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                sourceReference: string;
                importedAt: string;
                msaStatus: "unknown" | "available" | "not_available";
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
                    disposition: "excluded";
                    originalRow: number;
                    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                    operatorReference: string;
                    sequence?: string | undefined;
                    timestamp?: string | undefined;
                    subgroup?: string | undefined;
                    batch?: string | undefined;
                })[];
                missingRowCount: number;
                rejectionSummaries: {
                    reason: "non_finite_value" | "invalid_row" | "missing_value";
                    rowNumber: number;
                }[];
                originalRowCount: number;
                analyzedCount: number;
                contentHash: string;
            } | undefined;
        } | undefined;
        distributionFitResult?: {
            factorId: string;
            sampleSize: number;
            characteristicKind: "dimensional" | "other";
            candidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                    status: "acceptable" | "weak" | "rejected";
                    statisticId: "anderson_darling";
                    observedStatistic: number;
                    comparisonDirection: "greater_than_or_equal";
                    refitEachReplicate: true;
                    extremeReplicateCount: number;
                    confidenceInterval: {
                        level: 0.95;
                        method: "wilson_score";
                        lower: number;
                        upper: number;
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
            failedCandidates: {
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                reasonCode: "numerical_fit_failed";
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
                methodId: "F7_MODEL_SELECTION_V1";
                competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                confidence: "low" | "moderate";
                reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
            };
        } | undefined;
        distributionApproval?: {
            confirmed: true;
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
            approvedAt: string;
        } | undefined;
    }[];
    selectedWorksheetNames: string[];
    worksheetOptions: {
        worksheetName: string;
        selectionIndex: number;
        toleranceLoopDescription: string;
        worksheetKind: "analysis" | "example_or_template";
        source: {
            summarySheet: "Auto Summary";
            summaryRow: number;
            worksheetAnchor: string;
        } | {
            worksheetAnchor: string;
            discoveryMethod: "worksheet_scan";
            descriptionCell: string;
        };
    }[];
    systemSpecification?: {
        status: "available";
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
    monteCarloResult?: {
        status: "complete";
        standardDeviation: number;
        lowerSpecLimit: number;
        upperSpecLimit: number;
        methodId: "F7_MONTE_CARLO_V1";
        mean: number;
        targetSigmaLevel: number;
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
        yield: number;
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
            standardDeviation: number;
            methodId: "F7_NORMAL_MOMENT_FIT_V1";
            mean: number;
            expectedBinCounts: number[];
        };
        capability: {
            status: "available";
            cp: number;
            lowerCpk: number;
            upperCpk: number;
            cpk: number;
            targetCpk: number;
            targetStatus: "meets_target" | "below_target";
        } | {
            status: "not_available";
            reason: "zero_variance";
            targetCpk: number;
        };
        normalModel: {
            status: "available";
            lowerTailDpm: number;
            upperTailDpm: number;
            totalDpm: number;
            expectedYield: number;
        } | {
            status: "not_available";
            reason: "zero_variance";
        };
        factorManifest: {
            factorId: string;
            family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
    fileName: string;
    contractId: "f7-analysis-request-v1";
    inputClassification: "confidential";
    workbookBytes: Uint8Array<ArrayBuffer>;
}, {
    fileName: string;
    contractId: "f7-analysis-request-v1";
    inputClassification: "confidential";
    workbookBytes: Uint8Array<ArrayBuffer>;
}>;
export declare const f7MeasurementPasteRequestSchema: z.ZodObject<{
    factorId: z.ZodString;
    unit: z.ZodString;
    structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
    sourceReference: z.ZodString;
    msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
    text: z.ZodString;
}, "strict", z.ZodTypeAny, {
    factorId: string;
    unit: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    msaStatus: "unknown" | "available" | "not_available";
    text: string;
}, {
    factorId: string;
    unit: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    msaStatus: "unknown" | "available" | "not_available";
    text: string;
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
    factorId: string;
    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
    operatorReference: string;
    rowNumbers: number[];
    action: "EXCLUDE" | "RESTORE";
}, {
    confirmed: true;
    factorId: string;
    reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
    operatorReference: string;
    rowNumbers: number[];
    action: "EXCLUDE" | "RESTORE";
}>;
export declare const f7AnalysisRequestSchema: z.ZodObject<{
    contractId: z.ZodLiteral<"f7-analysis-request-v1">;
    inputClassification: z.ZodLiteral<"confidential">;
    sessionId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    contractId: "f7-analysis-request-v1";
    sessionId: string;
    inputClassification: "confidential";
}, {
    contractId: "f7-analysis-request-v1";
    sessionId: string;
    inputClassification: "confidential";
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
            workbookContentHash: string;
            fileName: string;
        }, {
            workbookContentHash: string;
            fileName: string;
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
            worksheetName: string;
            selectionIndex: number;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
        }, {
            worksheetName: string;
            selectionIndex: number;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
        }>, "many">;
        systemSpecification: z.ZodOptional<z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
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
                designNominal: z.ZodEffects<z.ZodNumber, number, number>;
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
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            }, {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            }>, {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            }, {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            }>;
            setup: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
                sigmaLevel: z.ZodOptional<z.ZodNumber>;
                distribution: z.ZodOptional<z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>>;
                confirmed: z.ZodLiteral<true>;
                designNominal: z.ZodEffects<z.ZodNumber, number, number>;
                upperTolerance: z.ZodNumber;
                lowerTolerance: z.ZodNumber;
                factorCandidateId: z.ZodString;
                factorName: z.ZodOptional<z.ZodString>;
                userAdded: z.ZodOptional<z.ZodLiteral<true>>;
            }, "strict", z.ZodTypeAny, {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            }, {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            }>, {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            }, {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            }>>;
            sourceMode: z.ZodOptional<z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>>;
            input: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
                mode: z.ZodLiteral<"MEASURED">;
                dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                    factorId: z.ZodString;
                    unit: z.ZodString;
                    structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }, {
                        value: number;
                        confirmed: true;
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
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
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                }, {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                }>, {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                }, {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                }>>;
            }, "strict", z.ZodTypeAny, {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            }, {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            }>, z.ZodObject<{
                mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
                baselineSampler: z.ZodObject<{
                    samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
                    physicalMean: z.ZodNumber;
                    standardDeviation: z.ZodNumber;
                    support: z.ZodLiteral<"REAL">;
                }, "strict", z.ZodTypeAny, {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                }, {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                }>;
            }, "strict", z.ZodTypeAny, {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            }, {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            }>]>>;
            evidence: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
                physicalMean: z.ZodNumber;
                signedContributionMean: z.ZodNumber;
                baselineSampler: z.ZodObject<{
                    samplerId: z.ZodLiteral<"NORMAL_LOCATION_SCALE_V1">;
                    physicalMean: z.ZodNumber;
                    standardDeviation: z.ZodNumber;
                    support: z.ZodLiteral<"REAL">;
                }, "strict", z.ZodTypeAny, {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                }, {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
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
                designNominal: z.ZodEffects<z.ZodNumber, number, number>;
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
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            }, {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            }>, {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            }, {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            }>>;
            datasetValidation: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<["ready", "blocked"]>;
                blockingIssues: z.ZodArray<z.ZodObject<{
                    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                    factorId: z.ZodOptional<z.ZodString>;
                    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                }, "strict", z.ZodTypeAny, {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }, {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }>, "many">;
                advisoryIssues: z.ZodArray<z.ZodObject<{
                    reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                    factorId: z.ZodOptional<z.ZodString>;
                    rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                }, "strict", z.ZodTypeAny, {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }, {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
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
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                }, {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                }>;
            }, "strict", z.ZodTypeAny, {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            }, {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            }>>;
            measurementPasteResult: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<["ready", "blocked"]>;
                factorId: z.ZodString;
                dataset: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                    factorId: z.ZodString;
                    unit: z.ZodString;
                    structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    }, {
                        value: number;
                        confirmed: true;
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
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
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                }, {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                }>, {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                }, {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                }>>;
                validation: z.ZodObject<{
                    status: z.ZodEnum<["ready", "blocked"]>;
                    blockingIssues: z.ZodArray<z.ZodObject<{
                        reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                        factorId: z.ZodOptional<z.ZodString>;
                        rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                    }, "strict", z.ZodTypeAny, {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }, {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }>, "many">;
                    advisoryIssues: z.ZodArray<z.ZodObject<{
                        reason: z.ZodEnum<["subgroup_too_small", "ordered_sequence_invalid", "sample_count_below_minimum", "exploratory_only", "fit_uncertainty", "unit_mismatch", "specification_missing", "non_finite_measurement", "duplicate_measurement", "msa_evidence_missing", "mixed_batch_conditions", "outlier_candidate", "invalid_rows_rejected"]>;
                        factorId: z.ZodOptional<z.ZodString>;
                        rowNumbers: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodNumber, "many">, number[], number[]>, number[], number[]>>;
                    }, "strict", z.ZodTypeAny, {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }, {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
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
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    }, {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    }>;
                }, "strict", z.ZodTypeAny, {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                }, {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                }>;
            }, "strict", z.ZodTypeAny, {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            }, {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
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
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                        }, {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                        }>, {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                        }, {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                        }>;
                        pValue: z.ZodNumber;
                        replicates: z.ZodLiteral<10000>;
                        seed: z.ZodString;
                        methodId: z.ZodLiteral<"F7_BOOTSTRAP_V2">;
                        candidateMethodId: z.ZodLiteral<"F7_DISTRIBUTION_FIT_V1">;
                        streamDigest: z.ZodString;
                        status: z.ZodEnum<["acceptable", "weak", "rejected"]>;
                    }, "strict", z.ZodTypeAny, {
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    }, {
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    }>, {
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
                        };
                        pValue: number;
                        replicates: 10000;
                        seed: string;
                        methodId: "F7_BOOTSTRAP_V2";
                        candidateMethodId: "F7_DISTRIBUTION_FIT_V1";
                        streamDigest: string;
                    }, {
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
                }, {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                }, {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                }>, {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                }, {
                    status: "unique_preference" | "no_unique_preference" | "no_acceptable_model" | "withheld_candidate_failures";
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                }>;
            }, "strict", z.ZodTypeAny, {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            }, {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            }>, {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            }, {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
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
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            }, {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            }>>;
        }, "strict", z.ZodTypeAny, {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }, {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }>, {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }, {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            }, {
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
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
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            }, {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            }>, z.ZodObject<{
                status: z.ZodLiteral<"not_available">;
                reason: z.ZodLiteral<"zero_variance">;
                targetCpk: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            }, {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            }>]>;
            normalModel: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
                status: z.ZodLiteral<"available">;
                lowerTailDpm: z.ZodNumber;
                upperTailDpm: z.ZodNumber;
                totalDpm: z.ZodNumber;
                expectedYield: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            }, {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
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
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }, {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }>, "many">;
        }, "strict", z.ZodTypeAny, {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        }, {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        }>, {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        }, {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        }>>;
    }, "strict", z.ZodTypeAny, {
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        workbook: {
            workbookContentHash: string;
            fileName: string;
        };
        contractId: "f7-analysis-result-v1";
        outputClassification: "confidential";
        sessionId: string;
        factors: {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }[];
        selectedWorksheetNames: string[];
        worksheetOptions: {
            worksheetName: string;
            selectionIndex: number;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
        }[];
        systemSpecification?: {
            status: "available";
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
        monteCarloResult?: {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    }, {
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        workbook: {
            workbookContentHash: string;
            fileName: string;
        };
        contractId: "f7-analysis-result-v1";
        outputClassification: "confidential";
        sessionId: string;
        factors: {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }[];
        selectedWorksheetNames: string[];
        worksheetOptions: {
            worksheetName: string;
            selectionIndex: number;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
        }[];
        systemSpecification?: {
            status: "available";
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
        monteCarloResult?: {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    }>, {
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        workbook: {
            workbookContentHash: string;
            fileName: string;
        };
        contractId: "f7-analysis-result-v1";
        outputClassification: "confidential";
        sessionId: string;
        factors: {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }[];
        selectedWorksheetNames: string[];
        worksheetOptions: {
            worksheetName: string;
            selectionIndex: number;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
        }[];
        systemSpecification?: {
            status: "available";
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
        monteCarloResult?: {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    }, {
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        workbook: {
            workbookContentHash: string;
            fileName: string;
        };
        contractId: "f7-analysis-result-v1";
        outputClassification: "confidential";
        sessionId: string;
        factors: {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }[];
        selectedWorksheetNames: string[];
        worksheetOptions: {
            worksheetName: string;
            selectionIndex: number;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
        }[];
        systemSpecification?: {
            status: "available";
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
        monteCarloResult?: {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    contractId: "f7-analysis-result-v1";
    outputClassification: "confidential";
    snapshot: {
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        workbook: {
            workbookContentHash: string;
            fileName: string;
        };
        contractId: "f7-analysis-result-v1";
        outputClassification: "confidential";
        sessionId: string;
        factors: {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }[];
        selectedWorksheetNames: string[];
        worksheetOptions: {
            worksheetName: string;
            selectionIndex: number;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
        }[];
        systemSpecification?: {
            status: "available";
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
        monteCarloResult?: {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                sourceMode: "MEASURED" | "BASELINE_ASSUMPTION";
            }[];
        } | undefined;
    };
}, {
    contractId: "f7-analysis-result-v1";
    outputClassification: "confidential";
    snapshot: {
        status: "worksheet_selection" | "factor_setup" | "measurement_entry" | "phase_1_ready";
        workbook: {
            workbookContentHash: string;
            fileName: string;
        };
        contractId: "f7-analysis-result-v1";
        outputClassification: "confidential";
        sessionId: string;
        factors: {
            factorCandidate: {
                standardDeviation: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                excelSignedMean: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                userAdded?: true | undefined;
                workbookUnitEvidence?: string | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
            };
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
            evidence?: {
                physicalMean: number;
                workbookContentHash: string;
                worksheetName: string;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                factorName: string;
                longTermSafetyFactor: number;
                sigmaLevel: number;
                distribution: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta";
                lowerSpecLimit: number;
                upperSpecLimit: number;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                factorId: string;
                unit: string;
                unitSource: "workbook" | "user_confirmed" | "unspecified";
                loopCoefficient: 1 | -1;
                signedContributionMean: number;
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                calculatedMean: number;
                tolerance: number;
                oneSigma: number;
                percentContributionToSigma: number;
                userAdded?: true | undefined;
            } | undefined;
            setup?: {
                factorCandidateId: string;
                designNominal: number;
                upperTolerance: number;
                lowerTolerance: number;
                confirmed: true;
                factorName?: string | undefined;
                userAdded?: true | undefined;
                longTermSafetyFactor?: number | undefined;
                sigmaLevel?: number | undefined;
                distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
            } | undefined;
            input?: {
                mode: "MEASURED";
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | {
                baselineSampler: {
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    standardDeviation: number;
                    support: "REAL";
                };
                mode: "BASELINE_ASSUMPTION";
            } | undefined;
            datasetValidation?: {
                status: "ready" | "blocked";
                blockingIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                advisoryIssues: {
                    reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                    factorId?: string | undefined;
                    rowNumbers?: number[] | undefined;
                }[];
                candidateEligibility: {
                    normal: "eligible";
                    lognormal: "eligible" | "ineligible_nonpositive";
                    weibull: "eligible" | "ineligible_nonpositive";
                    gamma: "eligible" | "ineligible_nonpositive";
                    uniform: "eligible_with_boundary_warning";
                };
            } | undefined;
            measurementPasteResult?: {
                status: "ready" | "blocked";
                validation: {
                    status: "ready" | "blocked";
                    blockingIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    advisoryIssues: {
                        reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected";
                        factorId?: string | undefined;
                        rowNumbers?: number[] | undefined;
                    }[];
                    candidateEligibility: {
                        normal: "eligible";
                        lognormal: "eligible" | "ineligible_nonpositive";
                        weibull: "eligible" | "ineligible_nonpositive";
                        gamma: "eligible" | "ineligible_nonpositive";
                        uniform: "eligible_with_boundary_warning";
                    };
                };
                factorId: string;
                dataset?: {
                    factorId: string;
                    unit: string;
                    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
                    sourceReference: string;
                    importedAt: string;
                    msaStatus: "unknown" | "available" | "not_available";
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
                        disposition: "excluded";
                        originalRow: number;
                        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
                        operatorReference: string;
                        sequence?: string | undefined;
                        timestamp?: string | undefined;
                        subgroup?: string | undefined;
                        batch?: string | undefined;
                    })[];
                    missingRowCount: number;
                    rejectionSummaries: {
                        reason: "non_finite_value" | "invalid_row" | "missing_value";
                        rowNumber: number;
                    }[];
                    originalRowCount: number;
                    analyzedCount: number;
                    contentHash: string;
                } | undefined;
            } | undefined;
            distributionFitResult?: {
                factorId: string;
                sampleSize: number;
                characteristicKind: "dimensional" | "other";
                candidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
                        status: "acceptable" | "weak" | "rejected";
                        statisticId: "anderson_darling";
                        observedStatistic: number;
                        comparisonDirection: "greater_than_or_equal";
                        refitEachReplicate: true;
                        extremeReplicateCount: number;
                        confidenceInterval: {
                            level: 0.95;
                            method: "wilson_score";
                            lower: number;
                            upper: number;
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
                failedCandidates: {
                    family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                    reasonCode: "numerical_fit_failed";
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
                    methodId: "F7_MODEL_SELECTION_V1";
                    competitiveFamilies: ("normal" | "lognormal" | "weibull" | "gamma" | "uniform")[];
                    confidence: "low" | "moderate";
                    reasonCodes: ("SINGLE_ACCEPTABLE_COMPETITOR" | "MULTIPLE_COMPETITIVE_MODELS" | "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" | "SMALL_SAMPLE_UNCERTAINTY" | "NO_ACCEPTABLE_MODEL" | "CANDIDATE_FIT_FAILURES")[];
                    numericBestFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    engineeringDefaultFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                    proposedFinalFamily?: "normal" | "lognormal" | "weibull" | "gamma" | "uniform" | undefined;
                };
            } | undefined;
            distributionApproval?: {
                confirmed: true;
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
                approvedAt: string;
            } | undefined;
        }[];
        selectedWorksheetNames: string[];
        worksheetOptions: {
            worksheetName: string;
            selectionIndex: number;
            toleranceLoopDescription: string;
            worksheetKind: "analysis" | "example_or_template";
            source: {
                summarySheet: "Auto Summary";
                summaryRow: number;
                worksheetAnchor: string;
            } | {
                worksheetAnchor: string;
                discoveryMethod: "worksheet_scan";
                descriptionCell: string;
            };
        }[];
        systemSpecification?: {
            status: "available";
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
        monteCarloResult?: {
            status: "complete";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            methodId: "F7_MONTE_CARLO_V1";
            mean: number;
            targetSigmaLevel: number;
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
            yield: number;
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
                standardDeviation: number;
                methodId: "F7_NORMAL_MOMENT_FIT_V1";
                mean: number;
                expectedBinCounts: number[];
            };
            capability: {
                status: "available";
                cp: number;
                lowerCpk: number;
                upperCpk: number;
                cpk: number;
                targetCpk: number;
                targetStatus: "meets_target" | "below_target";
            } | {
                status: "not_available";
                reason: "zero_variance";
                targetCpk: number;
            };
            normalModel: {
                status: "available";
                lowerTailDpm: number;
                upperTailDpm: number;
                totalDpm: number;
                expectedYield: number;
            } | {
                status: "not_available";
                reason: "zero_variance";
            };
            factorManifest: {
                factorId: string;
                family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
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
        confirmed: true;
        selectedWorksheetNames: string[];
    }, {
        workbookContentHash: string;
        confirmed: true;
        selectedWorksheetNames: string[];
    }>, {
        workbookContentHash: string;
        confirmed: true;
        selectedWorksheetNames: string[];
    }, {
        workbookContentHash: string;
        confirmed: true;
        selectedWorksheetNames: string[];
    }>;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
    confirmation: {
        workbookContentHash: string;
        confirmed: true;
        selectedWorksheetNames: string[];
    };
}, {
    sessionId: string;
    confirmation: {
        workbookContentHash: string;
        confirmed: true;
        selectedWorksheetNames: string[];
    };
}>;
export declare const f7FactorConfirmRouteRequestSchema: z.ZodEffects<z.ZodObject<{
    sessionId: z.ZodString;
    confirmations: z.ZodArray<z.ZodEffects<z.ZodObject<{
        longTermSafetyFactor: z.ZodOptional<z.ZodNumber>;
        sigmaLevel: z.ZodOptional<z.ZodNumber>;
        distribution: z.ZodOptional<z.ZodEnum<["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"]>>;
        confirmed: z.ZodLiteral<true>;
        designNominal: z.ZodEffects<z.ZodNumber, number, number>;
        upperTolerance: z.ZodNumber;
        lowerTolerance: z.ZodNumber;
        factorCandidateId: z.ZodString;
        factorName: z.ZodOptional<z.ZodString>;
        userAdded: z.ZodOptional<z.ZodLiteral<true>>;
    }, "strict", z.ZodTypeAny, {
        factorCandidateId: string;
        designNominal: number;
        upperTolerance: number;
        lowerTolerance: number;
        confirmed: true;
        factorName?: string | undefined;
        userAdded?: true | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    }, {
        factorCandidateId: string;
        designNominal: number;
        upperTolerance: number;
        lowerTolerance: number;
        confirmed: true;
        factorName?: string | undefined;
        userAdded?: true | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    }>, {
        factorCandidateId: string;
        designNominal: number;
        upperTolerance: number;
        lowerTolerance: number;
        confirmed: true;
        factorName?: string | undefined;
        userAdded?: true | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    }, {
        factorCandidateId: string;
        designNominal: number;
        upperTolerance: number;
        lowerTolerance: number;
        confirmed: true;
        factorName?: string | undefined;
        userAdded?: true | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
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
        factorCandidateId: string;
        designNominal: number;
        upperTolerance: number;
        lowerTolerance: number;
        confirmed: true;
        factorName?: string | undefined;
        userAdded?: true | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    }[];
    systemSpecification?: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    } | undefined;
}, {
    sessionId: string;
    confirmations: {
        factorCandidateId: string;
        designNominal: number;
        upperTolerance: number;
        lowerTolerance: number;
        confirmed: true;
        factorName?: string | undefined;
        userAdded?: true | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    }[];
    systemSpecification?: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    } | undefined;
}>, {
    sessionId: string;
    confirmations: {
        factorCandidateId: string;
        designNominal: number;
        upperTolerance: number;
        lowerTolerance: number;
        confirmed: true;
        factorName?: string | undefined;
        userAdded?: true | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
    }[];
    systemSpecification?: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
    } | undefined;
}, {
    sessionId: string;
    confirmations: {
        factorCandidateId: string;
        designNominal: number;
        upperTolerance: number;
        lowerTolerance: number;
        confirmed: true;
        factorName?: string | undefined;
        userAdded?: true | undefined;
        longTermSafetyFactor?: number | undefined;
        sigmaLevel?: number | undefined;
        distribution?: "Normal" | "Uniform" | "Triangular" | "Trapezoidal" | "Elliptical" | "Beta" | undefined;
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
        mode: "MEASURED" | "BASELINE_ASSUMPTION";
        sessionId: string;
    }, {
        mode: "MEASURED" | "BASELINE_ASSUMPTION";
        sessionId: string;
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        mode: "MEASURED" | "BASELINE_ASSUMPTION";
        sessionId: string;
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        mode: "MEASURED" | "BASELINE_ASSUMPTION";
        sessionId: string;
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
    body: z.ZodObject<{
        sessionId: z.ZodString;
        structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
        sourceReference: z.ZodString;
        msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
        text: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        sessionId: string;
        text: string;
    }, {
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        sessionId: string;
        text: string;
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        sessionId: string;
        text: string;
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
        sessionId: string;
        text: string;
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
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        rowNumbers: number[];
        sessionId: string;
        action: "EXCLUDE" | "RESTORE";
    }, {
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        rowNumbers: number[];
        sessionId: string;
        action: "EXCLUDE" | "RESTORE";
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        rowNumbers: number[];
        sessionId: string;
        action: "EXCLUDE" | "RESTORE";
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        confirmed: true;
        reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
        operatorReference: string;
        rowNumbers: number[];
        sessionId: string;
        action: "EXCLUDE" | "RESTORE";
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
        confirmed: true;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sessionId: string;
    }, {
        confirmed: true;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sessionId: string;
    }>;
}, "strict", z.ZodTypeAny, {
    params: {
        factorId: string;
    };
    body: {
        confirmed: true;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sessionId: string;
    };
}, {
    params: {
        factorId: string;
    };
    body: {
        confirmed: true;
        family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform";
        sessionId: string;
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
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        sessionId: string;
    }, {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        sessionId: string;
    }>;
}, "strict", z.ZodTypeAny, {
    body: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        sessionId: string;
    };
}, {
    body: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        sessionId: string;
    };
}>, {
    body: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        sessionId: string;
    };
}, {
    body: {
        lowerSpecLimit: number;
        upperSpecLimit: number;
        targetSigmaLevel: number;
        iterations: 10000 | 100000;
        runSeed: string;
        correlationMode: "INDEPENDENT";
        sessionId: string;
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
}
//# sourceMappingURL=f7-contracts.d.ts.map