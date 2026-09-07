import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const nonEmptyStringSchema = z.string().trim().min(1);
const nonBlankPreservedStringSchema = z.string().refine((value) => value.trim().length > 0, "must not be blank");
const forbiddenDisplayColumnNames = new Set(["source", "evidence", "provenance", "来源", "证据"]);

function markdownHasForbiddenDisplayColumn(markdown: string): boolean {
  return markdown.split(/\r?\n/u)
    .filter((line) => line.trim().startsWith("|") && line.trim().endsWith("|"))
    .some((line) => line.split("|").slice(1, -1)
      .some((cell) => forbiddenDisplayColumnNames.has(cell.trim().toLowerCase())));
}

function projectionHasForbiddenDisplayKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(projectionHasForbiddenDisplayKey);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => (
    forbiddenDisplayColumnNames.has(key.trim().toLowerCase()) || projectionHasForbiddenDisplayKey(child)
  ));
}

export const taReportDispositionSchema = z.enum(["PASS", "CONDITIONAL_PASS", "INCOMPLETE", "FAIL"]);

export const taReportWorksheetDispositionSchema = z.object({
  worksheetName: nonEmptyStringSchema,
  disposition: taReportDispositionSchema,
}).strict();

export const taEngineeringReportWorksheetProjectionSchema = z.object({
  worksheetName: nonEmptyStringSchema,
  toleranceLoopDescription: nonEmptyStringSchema,
  disposition: taReportDispositionSchema,
  requiredAction: nonEmptyStringSchema,
  findings: z.array(nonEmptyStringSchema),
  assumptions: z.array(nonEmptyStringSchema),
  clarifications: z.array(nonEmptyStringSchema),
  gatingEvidenceReferences: z.array(nonEmptyStringSchema),
  metrics: z.object({
    mean: z.number().finite().optional(),
    rssSigma: z.number().finite().optional(),
    worstCaseLower: z.number().finite().optional(),
    worstCaseUpper: z.number().finite().optional(),
    cp: z.number().finite().optional(),
    cpk: z.number().finite().optional(),
    yield: z.number().finite().optional(),
    dpm: z.number().finite().optional(),
  }).strict().optional(),
}).strict();

export const taEngineeringReportProjectionContentSchema = z.object({
  schemaVersion: z.literal("ta-engineering-report-projection-v1"),
  title: nonEmptyStringSchema,
  workbookDisposition: taReportDispositionSchema,
  worksheetDispositions: z.array(taReportWorksheetDispositionSchema).min(1),
  workbook: z.object({
    fileName: nonEmptyStringSchema,
    revision: nonEmptyStringSchema.optional(),
    contentHash: sha256Schema,
  }).strict(),
  worksheets: z.array(taEngineeringReportWorksheetProjectionSchema),
}).strict();

export const taEngineeringReportProjectionSchema = z.object({
  markdown: nonBlankPreservedStringSchema,
  reportSummary: z.object({
    workbookDisposition: taReportDispositionSchema,
    worksheetDispositions: z.array(taReportWorksheetDispositionSchema).min(1),
  }).strict(),
  projection: taEngineeringReportProjectionContentSchema,
}).strict().superRefine((report, context) => {
  if (markdownHasForbiddenDisplayColumn(report.markdown)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "user report must not expose provenance display columns", path: ["markdown"] });
  }
  if (projectionHasForbiddenDisplayKey(report.projection)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "structured report must not expose provenance display fields", path: ["projection"] });
  }
});

export type TaReportDisposition = z.infer<typeof taReportDispositionSchema>;
export type TaReportWorksheetDisposition = z.infer<typeof taReportWorksheetDispositionSchema>;
export type TaEngineeringReportWorksheetProjection = z.infer<typeof taEngineeringReportWorksheetProjectionSchema>;
export type TaEngineeringReportProjectionContent = z.infer<typeof taEngineeringReportProjectionContentSchema>;
export type TaEngineeringReportProjection = z.infer<typeof taEngineeringReportProjectionSchema>;
