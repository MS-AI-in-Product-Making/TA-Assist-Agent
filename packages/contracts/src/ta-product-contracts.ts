import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const nonEmptyStringSchema = z.string().trim().min(1);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const controlledArtifactIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/);

export const taProductRunReferenceSchema = z.string().regex(/^ta-run-[a-z0-9]{8}$/);

export const taProductExportRecordSchema = z.object({
  displayName: nonEmptyStringSchema,
  fileName: nonEmptyStringSchema,
  mediaType: nonEmptyStringSchema,
  byteSize: z.number().int().nonnegative(),
  sha256: sha256Schema,
}).strict();

const controlledSourceArtifactSchema = z.object({
  artifactId: controlledArtifactIdSchema,
  sha256: sha256Schema,
}).strict();

export const validatedTaBaselineReferenceSchema = z.object({
  contractVersion: z.literal("validated-ta-baseline-reference-v1"),
  baselineSessionId: nonEmptyStringSchema,
  baselineRunReference: nonEmptyStringSchema,
  workbookContentHash: sha256Schema,
  finalReportSha256: sha256Schema,
  sourceArtifacts: z.object({
    drawingGovernance: controlledSourceArtifactSchema,
    calculation: controlledSourceArtifactSchema,
    interpretation: controlledSourceArtifactSchema,
    optimization: controlledSourceArtifactSchema,
  }).strict(),
}).strict();

export const taProductExportManifestSchema = z.object({
  contractVersion: z.literal("ta-assist-product-export-v1"),
  workflow: z.literal("TA Workbook Analysis"),
  generatedAt: isoDateTimeSchema,
  workbook: z.object({
    fileName: nonEmptyStringSchema,
    contentHash: sha256Schema,
  }).strict(),
  worksheetScope: z.array(nonEmptyStringSchema).min(1),
  executionStatus: z.enum(["completed", "failed", "cancelled"]),
  businessDisposition: z.enum(["PASS", "FAIL", "REVIEW", "UNKNOWN"]),
  exportStatus: z.enum(["completed", "partial", "failed"]),
  productRunReference: taProductRunReferenceSchema,
  files: z.array(taProductExportRecordSchema).min(1),
}).strict();

export type TaProductRunReference = z.infer<typeof taProductRunReferenceSchema>;
export type TaProductExportRecord = z.infer<typeof taProductExportRecordSchema>;
export type TaProductExportManifest = z.infer<typeof taProductExportManifestSchema>;
export type ValidatedTaBaselineReference = z.infer<typeof validatedTaBaselineReferenceSchema>;
