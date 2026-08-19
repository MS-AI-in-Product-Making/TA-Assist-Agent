import { z } from "zod";
import type { WorksheetSelectionConfirmation } from "./contracts.js";
export declare const f7LoopCoefficientSchema: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
export declare const f7FactorSourceModeSchema: z.ZodEnum<["MEASURED", "BASELINE_ASSUMPTION"]>;
export declare const f7MeasurementStructureSchema: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
export declare const f7MsaStatusSchema: z.ZodEnum<["available", "not_available", "unknown"]>;
export declare const f7BaselineSamplerSchema: z.ZodObject<{
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
}>;
export declare const f7FactorCandidateSchema: z.ZodEffects<z.ZodObject<{
    workbookContentHash: z.ZodString;
    worksheetName: z.ZodString;
    tableId: z.ZodString;
    sourceRow: z.ZodNumber;
    sourceCells: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Record<string, string>, Record<string, string>>;
    factorCandidateId: z.ZodString;
    factorName: z.ZodString;
    workbookUnitEvidence: z.ZodOptional<z.ZodString>;
    excelSignedMean: z.ZodNumber;
    standardDeviation: z.ZodNumber;
    distribution: z.ZodLiteral<"Normal">;
    lowerSpecLimit: z.ZodNumber;
    upperSpecLimit: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    distribution: "Normal";
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    excelSignedMean: number;
    workbookUnitEvidence?: string | undefined;
}, {
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    distribution: "Normal";
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    excelSignedMean: number;
    workbookUnitEvidence?: string | undefined;
}>, {
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    distribution: "Normal";
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    excelSignedMean: number;
    workbookUnitEvidence?: string | undefined;
}, {
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    distribution: "Normal";
    standardDeviation: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    factorCandidateId: string;
    excelSignedMean: number;
    workbookUnitEvidence?: string | undefined;
}>;
export declare const f7FactorSetupConfirmationSchema: z.ZodObject<{
    factorCandidateId: z.ZodString;
    loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
    unit: z.ZodString;
    confirmed: z.ZodLiteral<true>;
}, "strict", z.ZodTypeAny, {
    unit: string;
    confirmed: true;
    factorCandidateId: string;
    loopCoefficient: 1 | -1;
}, {
    unit: string;
    confirmed: true;
    factorCandidateId: string;
    loopCoefficient: 1 | -1;
}>;
export declare const f7UnitSourceSchema: z.ZodEnum<["workbook", "user_confirmed"]>;
export declare const f7FactorEvidenceSchema: z.ZodEffects<z.ZodObject<{
    workbookContentHash: z.ZodString;
    worksheetName: z.ZodString;
    tableId: z.ZodString;
    sourceRow: z.ZodNumber;
    sourceCells: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Record<string, string>, Record<string, string>>;
    factorCandidateId: z.ZodString;
    factorId: z.ZodString;
    factorName: z.ZodString;
    unit: z.ZodString;
    unitSource: z.ZodEnum<["workbook", "user_confirmed"]>;
    loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
    physicalMean: z.ZodNumber;
    signedContributionMean: z.ZodNumber;
    baselineSampler: z.ZodObject<{
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
    }>;
    lowerSpecLimit: z.ZodNumber;
    upperSpecLimit: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    unit: string;
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    physicalMean: number;
    factorCandidateId: string;
    loopCoefficient: 1 | -1;
    factorId: string;
    unitSource: "workbook" | "user_confirmed";
    signedContributionMean: number;
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    };
}, {
    unit: string;
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    physicalMean: number;
    factorCandidateId: string;
    loopCoefficient: 1 | -1;
    factorId: string;
    unitSource: "workbook" | "user_confirmed";
    signedContributionMean: number;
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    };
}>, {
    unit: string;
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    physicalMean: number;
    factorCandidateId: string;
    loopCoefficient: 1 | -1;
    factorId: string;
    unitSource: "workbook" | "user_confirmed";
    signedContributionMean: number;
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    };
}, {
    unit: string;
    factorName: string;
    worksheetName: string;
    workbookContentHash: string;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    tableId: string;
    sourceRow: number;
    sourceCells: Record<string, string>;
    physicalMean: number;
    factorCandidateId: string;
    loopCoefficient: 1 | -1;
    factorId: string;
    unitSource: "workbook" | "user_confirmed";
    signedContributionMean: number;
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    };
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
    } | undefined;
}>, z.ZodObject<{
    mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
    baselineSampler: z.ZodObject<{
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
    }>;
}, "strict", z.ZodTypeAny, {
    mode: "BASELINE_ASSUMPTION";
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
    };
}, {
    mode: "BASELINE_ASSUMPTION";
    baselineSampler: {
        standardDeviation: number;
        samplerId: "NORMAL_LOCATION_SCALE_V1";
        physicalMean: number;
        support: "REAL";
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
    selectionIndex: number;
    worksheetKind: "analysis" | "example_or_template";
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
    selectionIndex: number;
    worksheetKind: "analysis" | "example_or_template";
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
        selectionIndex: number;
        worksheetKind: "analysis" | "example_or_template";
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
        selectionIndex: number;
        worksheetKind: "analysis" | "example_or_template";
    }>, "many">;
    factors: z.ZodArray<z.ZodEffects<z.ZodObject<{
        factorCandidate: z.ZodEffects<z.ZodObject<{
            workbookContentHash: z.ZodString;
            worksheetName: z.ZodString;
            tableId: z.ZodString;
            sourceRow: z.ZodNumber;
            sourceCells: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Record<string, string>, Record<string, string>>;
            factorCandidateId: z.ZodString;
            factorName: z.ZodString;
            workbookUnitEvidence: z.ZodOptional<z.ZodString>;
            excelSignedMean: z.ZodNumber;
            standardDeviation: z.ZodNumber;
            distribution: z.ZodLiteral<"Normal">;
            lowerSpecLimit: z.ZodNumber;
            upperSpecLimit: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            workbookUnitEvidence?: string | undefined;
        }, {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            workbookUnitEvidence?: string | undefined;
        }>, {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            workbookUnitEvidence?: string | undefined;
        }, {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
            workbookUnitEvidence?: string | undefined;
        }>;
        setup: z.ZodOptional<z.ZodObject<{
            factorCandidateId: z.ZodString;
            loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
            unit: z.ZodString;
            confirmed: z.ZodLiteral<true>;
        }, "strict", z.ZodTypeAny, {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        }, {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
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
            } | undefined;
        }>, z.ZodObject<{
            mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
            baselineSampler: z.ZodObject<{
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
            }>;
        }, "strict", z.ZodTypeAny, {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        }, {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        }>]>>;
        evidence: z.ZodOptional<z.ZodEffects<z.ZodObject<{
            workbookContentHash: z.ZodString;
            worksheetName: z.ZodString;
            tableId: z.ZodString;
            sourceRow: z.ZodNumber;
            sourceCells: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Record<string, string>, Record<string, string>>;
            factorCandidateId: z.ZodString;
            factorId: z.ZodString;
            factorName: z.ZodString;
            unit: z.ZodString;
            unitSource: z.ZodEnum<["workbook", "user_confirmed"]>;
            loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
            physicalMean: z.ZodNumber;
            signedContributionMean: z.ZodNumber;
            baselineSampler: z.ZodObject<{
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
            }>;
            lowerSpecLimit: z.ZodNumber;
            upperSpecLimit: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        }, {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        }>, {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        }, {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
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
            } | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
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
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        setup?: {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
            } | undefined;
        } | undefined;
    }, {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
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
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        setup?: {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
            } | undefined;
        } | undefined;
    }>, {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
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
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        setup?: {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
            } | undefined;
        } | undefined;
    }, {
        factorCandidate: {
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
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
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        setup?: {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
            } | undefined;
        } | undefined;
    }>, "many">;
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
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
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
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        setup?: {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
            } | undefined;
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
        selectionIndex: number;
        worksheetKind: "analysis" | "example_or_template";
    }[];
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
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
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
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        setup?: {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
            } | undefined;
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
        selectionIndex: number;
        worksheetKind: "analysis" | "example_or_template";
    }[];
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
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
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
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        setup?: {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
            } | undefined;
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
        selectionIndex: number;
        worksheetKind: "analysis" | "example_or_template";
    }[];
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
            distribution: "Normal";
            standardDeviation: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            factorCandidateId: string;
            excelSignedMean: number;
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
            } | undefined;
        } | {
            mode: "BASELINE_ASSUMPTION";
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        evidence?: {
            unit: string;
            factorName: string;
            worksheetName: string;
            workbookContentHash: string;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            tableId: string;
            sourceRow: number;
            sourceCells: Record<string, string>;
            physicalMean: number;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
            factorId: string;
            unitSource: "workbook" | "user_confirmed";
            signedContributionMean: number;
            baselineSampler: {
                standardDeviation: number;
                samplerId: "NORMAL_LOCATION_SCALE_V1";
                physicalMean: number;
                support: "REAL";
            };
        } | undefined;
        setup?: {
            unit: string;
            confirmed: true;
            factorCandidateId: string;
            loopCoefficient: 1 | -1;
        } | undefined;
        sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
            } | undefined;
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
        selectionIndex: number;
        worksheetKind: "analysis" | "example_or_template";
    }[];
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
export declare const f7MeasurementPasteRequestSchema: z.ZodObject<{
    factorId: z.ZodString;
    unit: z.ZodString;
    structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
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
}, {
    unit: string;
    text: string;
    factorId: string;
    structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
    sourceReference: string;
    msaStatus: "unknown" | "available" | "not_available";
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
            selectionIndex: number;
            worksheetKind: "analysis" | "example_or_template";
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
            selectionIndex: number;
            worksheetKind: "analysis" | "example_or_template";
        }>, "many">;
        factors: z.ZodArray<z.ZodEffects<z.ZodObject<{
            factorCandidate: z.ZodEffects<z.ZodObject<{
                workbookContentHash: z.ZodString;
                worksheetName: z.ZodString;
                tableId: z.ZodString;
                sourceRow: z.ZodNumber;
                sourceCells: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Record<string, string>, Record<string, string>>;
                factorCandidateId: z.ZodString;
                factorName: z.ZodString;
                workbookUnitEvidence: z.ZodOptional<z.ZodString>;
                excelSignedMean: z.ZodNumber;
                standardDeviation: z.ZodNumber;
                distribution: z.ZodLiteral<"Normal">;
                lowerSpecLimit: z.ZodNumber;
                upperSpecLimit: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                workbookUnitEvidence?: string | undefined;
            }, {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                workbookUnitEvidence?: string | undefined;
            }>, {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                workbookUnitEvidence?: string | undefined;
            }, {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
                workbookUnitEvidence?: string | undefined;
            }>;
            setup: z.ZodOptional<z.ZodObject<{
                factorCandidateId: z.ZodString;
                loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
                unit: z.ZodString;
                confirmed: z.ZodLiteral<true>;
            }, "strict", z.ZodTypeAny, {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            }, {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
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
                } | undefined;
            }>, z.ZodObject<{
                mode: z.ZodLiteral<"BASELINE_ASSUMPTION">;
                baselineSampler: z.ZodObject<{
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
                }>;
            }, "strict", z.ZodTypeAny, {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            }, {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            }>]>>;
            evidence: z.ZodOptional<z.ZodEffects<z.ZodObject<{
                workbookContentHash: z.ZodString;
                worksheetName: z.ZodString;
                tableId: z.ZodString;
                sourceRow: z.ZodNumber;
                sourceCells: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Record<string, string>, Record<string, string>>;
                factorCandidateId: z.ZodString;
                factorId: z.ZodString;
                factorName: z.ZodString;
                unit: z.ZodString;
                unitSource: z.ZodEnum<["workbook", "user_confirmed"]>;
                loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
                physicalMean: z.ZodNumber;
                signedContributionMean: z.ZodNumber;
                baselineSampler: z.ZodObject<{
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
                }>;
                lowerSpecLimit: z.ZodNumber;
                upperSpecLimit: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            }, {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            }>, {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            }, {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
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
                } | undefined;
            }>>;
        }, "strict", z.ZodTypeAny, {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
            } | undefined;
        }, {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
            } | undefined;
        }>, {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
            } | undefined;
        }, {
            factorCandidate: {
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
            } | undefined;
        }>, "many">;
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
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
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
            selectionIndex: number;
            worksheetKind: "analysis" | "example_or_template";
        }[];
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
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
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
            selectionIndex: number;
            worksheetKind: "analysis" | "example_or_template";
        }[];
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
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
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
            selectionIndex: number;
            worksheetKind: "analysis" | "example_or_template";
        }[];
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
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
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
            selectionIndex: number;
            worksheetKind: "analysis" | "example_or_template";
        }[];
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
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
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
            selectionIndex: number;
            worksheetKind: "analysis" | "example_or_template";
        }[];
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
                distribution: "Normal";
                standardDeviation: number;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                factorCandidateId: string;
                excelSignedMean: number;
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
                } | undefined;
            } | {
                mode: "BASELINE_ASSUMPTION";
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            evidence?: {
                unit: string;
                factorName: string;
                worksheetName: string;
                workbookContentHash: string;
                lowerSpecLimit: number;
                upperSpecLimit: number;
                tableId: string;
                sourceRow: number;
                sourceCells: Record<string, string>;
                physicalMean: number;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
                factorId: string;
                unitSource: "workbook" | "user_confirmed";
                signedContributionMean: number;
                baselineSampler: {
                    standardDeviation: number;
                    samplerId: "NORMAL_LOCATION_SCALE_V1";
                    physicalMean: number;
                    support: "REAL";
                };
            } | undefined;
            setup?: {
                unit: string;
                confirmed: true;
                factorCandidateId: string;
                loopCoefficient: 1 | -1;
            } | undefined;
            sourceMode?: "MEASURED" | "BASELINE_ASSUMPTION" | undefined;
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
                } | undefined;
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
            selectionIndex: number;
            worksheetKind: "analysis" | "example_or_template";
        }[];
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
export declare const f7FactorConfirmRouteRequestSchema: z.ZodObject<{
    sessionId: z.ZodString;
    confirmations: z.ZodArray<z.ZodObject<{
        factorCandidateId: z.ZodString;
        loopCoefficient: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
        unit: z.ZodString;
        confirmed: z.ZodLiteral<true>;
    }, "strict", z.ZodTypeAny, {
        unit: string;
        confirmed: true;
        factorCandidateId: string;
        loopCoefficient: 1 | -1;
    }, {
        unit: string;
        confirmed: true;
        factorCandidateId: string;
        loopCoefficient: 1 | -1;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
    confirmations: {
        unit: string;
        confirmed: true;
        factorCandidateId: string;
        loopCoefficient: 1 | -1;
    }[];
}, {
    sessionId: string;
    confirmations: {
        unit: string;
        confirmed: true;
        factorCandidateId: string;
        loopCoefficient: 1 | -1;
    }[];
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
    body: z.ZodObject<{
        sessionId: z.ZodString;
        structure: z.ZodEnum<["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]>;
        sourceReference: z.ZodString;
        msaStatus: z.ZodEnum<["available", "not_available", "unknown"]>;
        text: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        sessionId: string;
        text: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
    }, {
        sessionId: string;
        text: string;
        structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
        sourceReference: string;
        msaStatus: "unknown" | "available" | "not_available";
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
export declare const f7SessionRouteParamsSchema: z.ZodObject<{
    sessionId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    sessionId: string;
}, {
    sessionId: string;
}>;
export type F7FactorCandidate = z.infer<typeof f7FactorCandidateSchema>;
export type F7FactorSetupConfirmation = z.infer<typeof f7FactorSetupConfirmationSchema>;
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
export type F7SessionRouteParams = z.infer<typeof f7SessionRouteParamsSchema>;
export interface F7SessionService {
    importWorkbook(request: F7WorkbookImportRequest): F7SessionSnapshot;
    confirmWorksheet(request: {
        sessionId: string;
        confirmation: WorksheetSelectionConfirmation;
    }): F7SessionSnapshot;
    confirmFactorSetup(request: {
        sessionId: string;
        confirmations: readonly F7FactorSetupConfirmation[];
    }): F7SessionSnapshot;
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
    getSession(sessionId: string): F7SessionSnapshot;
}
//# sourceMappingURL=f7-contracts.d.ts.map