import { loadProcessRequirements } from "@ai-assist/knowledge-base/process-requirements";
import { z } from "zod";
import { dimensionChainVisualSchema } from "./dimension-chain-visual.js";

const shortText = z.string().min(1).max(300);
const displayText = z.string().min(1).max(2_000);
const narrativeText = z.string().min(1).max(4_000);
const finiteNumber = z.number().finite();
const boundedAdditionalMeanShift = finiteNumber.min(-1_000_000_000).max(1_000_000_000);
const percentage = finiteNumber.min(0).max(100);
const nonNegativeInteger = z.number().int().nonnegative();
const boundedOffset = finiteNumber.min(-10_000).max(10_000);
const boundedId = z.string().regex(/^[a-f0-9]{64}$/);
const boundedBoundaryKey = z.string().regex(/^[a-f0-9]{64}::[a-f0-9]{64}$/);
const boundedText = z.string().min(1).max(20_000);
const boundedNonNegativeFinite = finiteNumber.min(0);
const sigmaBand = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(4),
  z.literal(4.5),
  z.literal(6),
]);
const setupDistribution = z.enum([
  "Normal",
  "Uniform",
  "Triangular",
  "Trapezoidal",
  "Elliptical",
  "Beta",
]);

const jsonSourceSignature = boundedText.superRefine((value, context) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") {
      context.addIssue({
        code: "custom",
        message: "sourceSignature must be JSON object or array text.",
      });
    }
  } catch {
    context.addIssue({
      code: "custom",
      message: "sourceSignature must be valid JSON text.",
    });
  }
});

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

const priorityValueSchema = z.enum(["P0", "P1", "P2", "P3"]);

const priorityRecommendationSchema = z.object({
  selectedPriority: priorityValueSchema,
  requiresMeDmAlignment: z.literal(true),
}).strict();

const priorityDefinitionSchema = z.object({
  priority: priorityValueSchema,
  title: shortText,
  message: narrativeText,
}).strict();

const PRIORITY_SEQUENCE = ["P0", "P1", "P2", "P3"] as const;
const canonicalPriorityDefinitions = (() => {
  const processRequirements = loadProcessRequirements({ version: "process-requirements-v3" });
  const definitions = processRequirements
    .listProcessRequirements({ topics: ["priority"], entryTypes: ["definition"] })
    .map((entry) => ({
      priority: entry.title.slice(0, 2),
      title: entry.title,
      message: entry.message,
    }));

  if (definitions.length !== PRIORITY_SEQUENCE.length) {
    throw new Error("Canonical process-requirements-v3 priority definitions are incomplete.");
  }

  for (const [index, definition] of definitions.entries()) {
    const priority = PRIORITY_SEQUENCE[index];
    if (!priority || definition?.priority !== priority) {
      throw new Error("Canonical process-requirements-v3 priority definitions are out of order.");
    }
  }

  return definitions as ReadonlyArray<{
    readonly priority: "P0" | "P1" | "P2" | "P3";
    readonly title: string;
    readonly message: string;
  }>;
})();

const engineeringEvidenceFactorRowSchema = z.object({
  itemNumber: nonNegativeInteger,
  factorName: shortText,
  designNominal: finiteNumber,
  upperTolerance: finiteNumber,
  lowerTolerance: finiteNumber,
  longTermSafetyFactor: finiteNumber,
  sigmaLevel: finiteNumber,
  distribution: setupDistribution,
  mean: finiteNumber,
  tolerance: finiteNumber,
  oneSigma: finiteNumber,
  contributionPercent: percentage,
}).strict();

const engineeringEvidenceFactorFooterSchema = z.object({
  designNominalTotal: finiteNumber,
  upperWorstCaseTolerance: finiteNumber,
  lowerWorstCaseTolerance: finiteNumber,
  meanResponse: finiteNumber,
  rssTolerance: finiteNumber,
  rssSigma: finiteNumber,
  contributionTotalPercent: percentage,
  additionalMeanShift: boundedAdditionalMeanShift,
  adjustedMean: finiteNumber,
}).strict();

const engineeringEvidenceFactorSetupSchema = z.object({
  rows: z.array(engineeringEvidenceFactorRowSchema).max(100),
  footer: engineeringEvidenceFactorFooterSchema,
}).strict();

const dimensionChainFactorSchema = z.object({
  id: boundedId,
  itemNumber: nonNegativeInteger,
  name: shortText,
  designNominal: finiteNumber,
  upperTolerance: finiteNumber,
  lowerTolerance: finiteNumber,
  longTermSafetyFactor: finiteNumber,
  sigmaLevel: finiteNumber,
  distribution: setupDistribution,
}).strict();

const dimensionChainManualLayoutSchema = z.object({
  boundaryOffsets: z.record(boundedBoundaryKey, boundedOffset),
  laneOffsets: z.record(boundedId, boundedOffset),
  closureStartOffset: boundedOffset.optional(),
  closureEndOffset: boundedOffset.optional(),
  closureLaneOffset: boundedOffset.optional(),
}).strict();

const dimensionChainSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("generated"),
    sourceSignature: jsonSourceSignature,
    orientation: z.enum(["horizontal", "vertical"]),
    factors: z.array(dimensionChainFactorSchema).max(100),
    manualLayout: dimensionChainManualLayoutSchema,
    reversedFactorIds: z.array(boundedId).max(100),
    closureDirection: z.enum(["start-to-end", "end-to-start"]),
  }).strict(),
  z.object({
    status: z.literal("fallback"),
    sourceSignature: jsonSourceSignature,
  }).strict(),
]);

const responseDistributionSchema = z.object({
  mean: finiteNumber,
  standardDeviation: finiteNumber,
  lowerSpecLimit: finiteNumber,
  upperSpecLimit: finiteNumber,
  target: finiteNumber,
}).strict();

const responseSummaryStatusMetricSchema = z.object({
  value: finiteNumber,
  status: z.enum(["PASS", "FAIL"]),
}).strict();

const responseSummarySchema = z.object({
  rssAndWorstCase: z.object({
    sigmaBands: z.array(z.object({
      sigma: sigmaBand,
      tolerance: finiteNumber,
      upper: finiteNumber,
      lower: finiteNumber,
    }).strict()).max(100),
    worstCase: z.object({
      tolerance: finiteNumber,
      upper: finiteNumber,
      lower: finiteNumber,
    }).strict(),
  }).strict(),
  responseAndSpecifications: z.object({
    designNominal: finiteNumber,
    meanResponse: finiteNumber,
    additionalMeanShift: boundedAdditionalMeanShift,
    adjustedMean: finiteNumber,
    lowerSpecLimit: finiteNumber,
    upperSpecLimit: finiteNumber,
    targetSigmaLevel: finiteNumber,
    targetCpk: finiteNumber,
  }).strict(),
  sigmaLevelAndCapability: z.object({
    lowerZ: responseSummaryStatusMetricSchema,
    upperZ: responseSummaryStatusMetricSchema,
    calculatedSigmaLevel: responseSummaryStatusMetricSchema,
    cp: responseSummaryStatusMetricSchema,
    lowerCpk: responseSummaryStatusMetricSchema,
    upperCpk: responseSummaryStatusMetricSchema,
    calculatedCpk: responseSummaryStatusMetricSchema,
  }).strict(),
  defectsPerMillion: z.object({
    lowerDpm: finiteNumber,
    upperDpm: finiteNumber,
    totalDpm: finiteNumber,
    outOfSpecPercent: finiteNumber,
    yieldPercent: finiteNumber,
    volume: nonNegativeInteger.optional(),
    failuresOverVolume: boundedNonNegativeFinite.optional(),
  }).strict(),
}).strict();

const engineeringEvidenceSchema = z.object({
  factorSetup: engineeringEvidenceFactorSetupSchema,
  dimensionChain: dimensionChainSchema,
  responseDistribution: responseDistributionSchema,
  responseSummary: responseSummarySchema,
}).strict();

export const assumptionResultsPdfRouteRequestSchema = z.object({
  sessionId: z.string().min(1).max(200),
  dimensionChainVisual: dimensionChainVisualSchema.optional(),
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
  priorityRecommendation: priorityRecommendationSchema.optional(),
  priorityDefinitions: z.array(priorityDefinitionSchema).max(4).optional(),
  processGuidance: z.array(guidanceSchema).max(50),
  engineeringEvidence: engineeringEvidenceSchema,
}).strict().superRefine((request, context) => {
  const definitions = request.priorityDefinitions;
  if (definitions !== undefined) {
    if (definitions.length !== PRIORITY_SEQUENCE.length) {
      context.addIssue({
        code: "custom",
        message: "priorityDefinitions must include exactly four canonical P0-P3 entries.",
        path: ["priorityDefinitions"],
      });
    } else {
      for (const [index, definition] of definitions.entries()) {
        const canonical = canonicalPriorityDefinitions[index];
        if (!canonical) {
          context.addIssue({
            code: "custom",
            message: "priorityDefinitions must include exactly four canonical P0-P3 entries.",
            path: ["priorityDefinitions", index],
          });
          continue;
        }
        if (definition.priority !== canonical.priority) {
          context.addIssue({
            code: "custom",
            message: "priorityDefinitions must be unique and ordered as P0, P1, P2, P3.",
            path: ["priorityDefinitions", index, "priority"],
          });
        }
        if (definition.title !== canonical.title) {
          context.addIssue({
            code: "custom",
            message: "priorityDefinitions title must match the canonical process requirements content.",
            path: ["priorityDefinitions", index, "title"],
          });
        }
        if (definition.message !== canonical.message) {
          context.addIssue({
            code: "custom",
            message: "priorityDefinitions message must match the canonical process requirements content.",
            path: ["priorityDefinitions", index, "message"],
          });
        }
      }
    }
  }

  if (request.priorityRecommendation !== undefined && definitions === undefined) {
    context.addIssue({
      code: "custom",
      message: "priorityRecommendation requires complete canonical priorityDefinitions.",
      path: ["priorityRecommendation"],
    });
  }

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