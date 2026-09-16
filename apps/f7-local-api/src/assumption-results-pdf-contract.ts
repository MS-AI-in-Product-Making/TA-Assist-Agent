import { z } from "zod";

const shortText = z.string().min(1).max(300);
const displayText = z.string().min(1).max(2_000);
const narrativeText = z.string().min(1).max(4_000);
const finiteNumber = z.number().finite();
const percentage = finiteNumber.min(0).max(100);

const summaryRowSchema = z.object({
  metric: shortText,
  result: shortText,
  reference: displayText,
  referenceDetail: displayText.optional(),
  difference: shortText,
  assessment: displayText,
  performanceContext: displayText,
  tone: z.enum(["pass", "fail", "warning"]).optional(),
}).strict();

const resultJudgmentSchema = z.object({
  status: z.enum(["meets-target", "below-target"]),
  headline: shortText,
}).strict();

const quantitativeEvidenceSchema = z.object({
  label: shortText,
  value: displayText,
}).strict();

const rootCauseItemSchema = z.object({
  title: shortText,
  narrative: narrativeText,
  hypothesisStatus: z.literal("hypothesis"),
  incompleteEvidence: z.boolean(),
  quantitativeEvidence: z.array(quantitativeEvidenceSchema).max(30),
}).strict();

const adjustmentRowSchema = z.object({
  current: displayText,
  recommended: displayText,
  adjustment: displayText,
}).strict();

const outcomeSchema = z.object({
  label: shortText,
  value: displayText,
  context: displayText,
}).strict();

const meanCenteringAdjustmentSchema = adjustmentRowSchema;

const specificationAdjustmentSchema = z.object({
  lower: adjustmentRowSchema,
  upper: adjustmentRowSchema,
}).strict();

const actionBaseShape = {
  title: shortText,
  narrative: narrativeText,
} as const;

const actionItemSchema = z.discriminatedUnion("optionId", [
  z.object({
    ...actionBaseShape,
    optionId: z.literal("improvement-center-mean"),
    meanCenteringAdjustment: meanCenteringAdjustmentSchema,
    outcome: outcomeSchema,
  }).strict(),
  z.object({
    ...actionBaseShape,
    optionId: z.literal("improvement-reduce-variation"),
  }).strict(),
  z.object({
    ...actionBaseShape,
    optionId: z.literal("improvement-reduce-contributor"),
  }).strict(),
  z.object({
    ...actionBaseShape,
    optionId: z.literal("improvement-relax-final-specification"),
    specificationAdjustment: specificationAdjustmentSchema,
    outcome: outcomeSchema,
  }).strict(),
]);

const contributorSchema = z.object({
  factorName: shortText,
  reference: displayText,
  designNominal: finiteNumber,
  upperTolerance: finiteNumber,
  lowerTolerance: finiteNumber,
  contributionPercent: percentage,
  cumulativePercent: percentage,
}).strict();

const guidanceSchema = z.object({
  state: z.enum(["guidance", "warning"]),
  title: shortText,
  message: narrativeText,
}).strict();

export const assumptionResultsPdfRouteRequestSchema = z.object({
  sessionId: z.string().min(1).max(200),
  workbookName: z.string().min(1).max(300),
  worksheetName: z.string().min(1).max(300),
  resultJudgment: resultJudgmentSchema,
  resultSummaryCaption: displayText,
  summaryRows: z.array(summaryRowSchema).min(1).max(20),
  overallAssessment: z.string().min(1).max(4_000),
  rootCauseItems: z.array(rootCauseItemSchema).max(30),
  actionItems: z.array(actionItemSchema).max(30),
  contributors: z.array(contributorSchema).max(100),
  processGuidanceContext: displayText,
  processGuidance: z.array(guidanceSchema).max(50),
}).strict().superRefine((request, context) => {
  for (let index = 1; index < request.contributors.length; index += 1) {
    const previous = request.contributors[index - 1];
    const current = request.contributors[index];
    if (previous !== undefined && current !== undefined
      && current.cumulativePercent < previous.cumulativePercent) {
      context.addIssue({
        code: "custom",
        message: "Cumulative contributor percentages must not decrease.",
        path: ["contributors", index, "cumulativePercent"],
      });
    }
  }
});

export type AssumptionResultsPdfRouteRequest = z.infer<typeof assumptionResultsPdfRouteRequestSchema>;

function safeFileNamePart(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint > 126 || /[<>:"/\\|?*]/.test(character) ? "-" : character;
    })
    .join("")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
}

function safeUnicodeFileNamePart(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      const isControl = codePoint < 32 || (codePoint >= 127 && codePoint <= 159);
      const isSurrogate = codePoint >= 0xD800 && codePoint <= 0xDFFF;
      return isControl || isSurrogate || /[<>:"/\\|?*]/u.test(character) ? "-" : character;
    })
    .join("")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^[.-]+|[.-]+$/gu, "");
}

function truncateWithoutSplittingSurrogates(value: string, maxLength: number): string {
  let result = "";
  for (const character of value) {
    if (result.length + character.length > maxLength) break;
    result += character;
  }
  return result;
}

export function safePdfDownloadFileName(workbookName: string, worksheetName: string): string {
  const workbookBase = workbookName.replace(/\.[^.]+$/u, "");
  const stem = [safeFileNamePart(workbookBase), safeFileNamePart(worksheetName)]
    .filter((part) => part.length > 0)
    .join("-") || "ta-results";
  const suffix = "-assumption-results.pdf";
  return `${stem.slice(0, 180 - suffix.length).replace(/[.-]+$/g, "")}${suffix}`;
}

export function safeUnicodePdfDownloadFileName(workbookName: string, worksheetName: string): string {
  const workbookBase = workbookName.replace(/\.[^.]+$/u, "");
  const stem = [safeUnicodeFileNamePart(workbookBase), safeUnicodeFileNamePart(worksheetName)]
    .filter((part) => part.length > 0)
    .join("-") || "ta-results";
  const suffix = "-assumption-results.pdf";
  const truncatedStem = truncateWithoutSplittingSurrogates(stem, 180 - suffix.length)
    .replace(/[.-]+$/gu, "");
  return `${truncatedStem}${suffix}`;
}

export function encodeRfc5987FileName(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}