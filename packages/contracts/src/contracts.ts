import { z } from "zod";

export const contractVersionSchema = z.literal("v1");

export const dataClassificationSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "secret",
]);

export const runRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  projectId: z.string().min(1),
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  inputClassification: dataClassificationSchema,
  retainConfidentialArtifacts: z.boolean(),
});

export const skillResultSchema = z.object({
  contractVersion: contractVersionSchema,
  skillId: z.string().min(1),
  outputClassification: dataClassificationSchema,
  evidenceReferences: z.array(z.string()),
  output: z.record(z.string(), z.unknown()),
});

export const capabilityTierSchema = z.enum(["T0", "T1", "T2", "T3"]);

export const distributionSchema = z.enum([
  "normal",
  "uniform",
  "triangular",
  "trapezoidal",
  "elliptical",
  "beta",
]);

export const knowledgeLibraryIdSchema = z.enum([
  "capability-library",
  "engineering-rules",
  "terminology-ontology",
]);

export const knowledgeBaseVersionSchema = z.literal("v1");

export const provenanceSchema = z
  .object({
    source: z.string().min(1),
    confidence: z.number().finite().min(0).max(1),
    owner: z.string().min(1),
    coverage: z.array(z.string().min(1)).min(1),
    effectiveVersion: knowledgeBaseVersionSchema,
    changeSummary: z.string().min(1),
  })
  .strict();

export const capabilityEntrySchema = z
  .object({
    entryId: z.string().min(1),
    partCategory: z.string().min(1),
    subsystem: z.string().min(1).optional(),
    datum: z.string().min(1).optional(),
    toleranceMin: z.number().finite().min(0),
    toleranceMax: z.number().finite().positive(),
    unit: z.literal("mm"),
    recommendedDistribution: distributionSchema,
    capabilityTier: capabilityTierSchema,
    provenance: provenanceSchema,
  })
  .strict()
  .refine((entry) => entry.toleranceMin <= entry.toleranceMax, {
    message: "toleranceMin must be less than or equal to toleranceMax",
    path: ["toleranceMin"],
  });

export const engineeringRuleEntrySchema = z
  .object({
    ruleId: z.enum(["cts-sigma", "ctf-sigma", "default-cpk-target"]),
    ruleType: z.enum(["sigma", "cpk"]),
    threshold: z.number().finite().positive(),
    unit: z.string().min(1),
    applicability: z.string().min(1),
    provenance: provenanceSchema,
  })
  .strict();

export const terminologyEntrySchema = z
  .object({
    entryId: z.string().min(1),
    termType: z.enum(["part-category", "subsystem", "datum"]),
    canonicalName: z.string().min(1),
    aliases: z.array(z.string().min(1)).default([]),
    definition: z.string().min(1),
    parentEntryId: z.string().min(1).optional(),
    provenance: provenanceSchema,
  })
  .strict();

const knowledgeLibraryManifestSchema = z.discriminatedUnion("libraryId", [
  z
    .object({
      libraryId: z.literal("capability-library"),
      contractId: z.literal("capability-library-v1"),
      entryCount: z.number().int().min(0),
      coverage: z.array(z.string().min(1)).min(1),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({
      libraryId: z.literal("engineering-rules"),
      contractId: z.literal("engineering-rules-v1"),
      entryCount: z.number().int().min(0),
      coverage: z.array(z.string().min(1)).min(1),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({
      libraryId: z.literal("terminology-ontology"),
      contractId: z.literal("terminology-ontology-v1"),
      entryCount: z.number().int().min(0),
      coverage: z.array(z.string().min(1)).min(1),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
]);

export const knowledgeBaseManifestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    knowledgeBaseVersion: knowledgeBaseVersionSchema,
    classification: z.literal("public"),
    releasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    changeSummary: z.string().min(1),
    libraries: z
      .array(knowledgeLibraryManifestSchema)
      .length(3)
      .refine(
        (libraries) => new Set(libraries.map((library) => library.libraryId)).size === 3,
        { message: "libraries must contain each library exactly once" },
      ),
  })
  .strict();

export const knowledgeBaseQueryRequestSchema = z
  .object({
    partCategory: z.string().min(1),
    tolerance: z.number().finite().min(0),
    unit: z.literal("mm"),
    subsystem: z.string().min(1).optional(),
    datum: z.string().min(1).optional(),
  })
  .strict();

export const engineeringRuleQuerySchema = z
  .object({
    ruleId: z.string().min(1),
  })
  .strict();

export const terminologyQuerySchema = z
  .object({
    termType: z.enum(["part-category", "subsystem", "datum"]),
    value: z.string().min(1),
  })
  .strict();

export const capabilityMatchResultSchema = z
  .object({
    queryType: z.literal("capability"),
    status: z.literal("matched"),
    contractVersion: contractVersionSchema,
    knowledgeBaseVersion: knowledgeBaseVersionSchema,
    entry: capabilityEntrySchema,
  })
  .strict();

export const capabilityUnknownResultSchema = z
  .object({
    queryType: z.literal("capability"),
    status: z.literal("unknown"),
    contractVersion: contractVersionSchema,
    knowledgeBaseVersion: knowledgeBaseVersionSchema,
    capabilityTier: z.literal("T0"),
    message: z.literal("制程能力未知，请与供应商确认"),
  })
  .strict();

export const engineeringRuleMatchResultSchema = z
  .object({
    queryType: z.literal("rule"),
    status: z.literal("matched"),
    contractVersion: contractVersionSchema,
    knowledgeBaseVersion: knowledgeBaseVersionSchema,
    entry: engineeringRuleEntrySchema,
  })
  .strict();

export const engineeringRuleUnknownResultSchema = z
  .object({
    queryType: z.literal("rule"),
    status: z.literal("unknown"),
    contractVersion: contractVersionSchema,
    knowledgeBaseVersion: knowledgeBaseVersionSchema,
  })
  .strict();

export const terminologyMatchResultSchema = z
  .object({
    queryType: z.literal("terminology"),
    status: z.literal("matched"),
    contractVersion: contractVersionSchema,
    knowledgeBaseVersion: knowledgeBaseVersionSchema,
    entry: terminologyEntrySchema,
  })
  .strict();

export const terminologyUnknownResultSchema = z
  .object({
    queryType: z.literal("terminology"),
    status: z.literal("unknown"),
    contractVersion: contractVersionSchema,
    knowledgeBaseVersion: knowledgeBaseVersionSchema,
  })
  .strict();

const filenameControlCharacters = new RegExp(`^[^/\\\\${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]+\\.xlsx$`, "i");

const workbookCatalogFileNameSchema = z
  .string()
  .min(1)
  .max(240)
  .regex(filenameControlCharacters)
  .refine((fileName) => !fileName.includes(".."), {
    message: "fileName must not contain traversal segments",
  });

export const workbookCatalogRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    fileName: workbookCatalogFileNameSchema,
    inputClassification: z.literal("confidential"),
    workbookBytes: z.instanceof(Uint8Array).refine((workbookBytes) => workbookBytes.length > 0, {
      message: "workbookBytes must not be empty",
    }),
  })
  .strict();

export const workbookCatalogDateSchema = z
  .object({
    value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    formula: z.string().min(1).optional(),
    sourceCell: z.string().regex(/^Title Page![A-Z]+[1-9]\d*$/),
  })
  .strict();

export const workbookCatalogAnalysisSchema = z
  .object({
    worksheetName: z.string().min(1),
    toleranceLoopDescription: z.string().min(1),
    source: z
      .object({
        summarySheet: z.literal("Auto Summary"),
        summaryRow: z.number().int().positive(),
        worksheetAnchor: z.string().regex(/^[^!]+!A1$/),
      })
      .strict(),
  })
  .strict();

export const workbookCatalogResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    workbook: z
      .object({
        fileName: workbookCatalogFileNameSchema,
        classification: z.literal("confidential"),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        metadata: z
          .object({
            documentNo: z.string().min(1),
            revision: z.string().min(1),
            date: workbookCatalogDateSchema,
          })
          .strict(),
      })
      .strict(),
    analyses: z.array(workbookCatalogAnalysisSchema).min(1),
  })
  .strict();

export const worksheetSelectionViewRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    workbookCatalog: workbookCatalogResultSchema,
  })
  .strict();

export const worksheetSelectionViewResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    workbook: z
      .object({
        fileName: workbookCatalogFileNameSchema,
        classification: z.literal("confidential"),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        revision: z.string().min(1),
        date: workbookCatalogDateSchema,
      })
      .strict(),
    worksheets: z
      .array(
        z
          .object({
            selectionIndex: z.number().int().positive(),
            worksheetName: z.string().min(1),
            toleranceLoopDescription: z.string().min(1),
            source: z
              .object({
                summarySheet: z.literal("Auto Summary"),
                summaryRow: z.number().int().positive(),
                worksheetAnchor: z.string().regex(/^[^!]+!A1$/),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const nonEmptyWorkbookBytesSchema = z.instanceof(Uint8Array).refine(
  (workbookBytes) => workbookBytes.length > 0,
  { message: "workbookBytes must not be empty" },
);

const worksheetSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }).strict(),
  z
    .object({
      mode: z.literal("selected"),
      worksheetNames: z.array(z.string().min(1)).min(1),
    })
    .strict(),
]);

export const worksheetAnalysisAssetsRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    workbookBytes: nonEmptyWorkbookBytesSchema,
    workbookCatalog: workbookCatalogResultSchema,
    worksheetSelection: worksheetSelectionSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.worksheetSelection?.mode === "selected"
      && new Set(request.worksheetSelection.worksheetNames).size !== request.worksheetSelection.worksheetNames.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheetNames must be unique", path: ["worksheetSelection", "worksheetNames"] });
    }
  });

const worksheetFieldNameSchema = z.enum([
  "factorName",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "upperSpecificationLimit",
  "lowerSpecificationLimit",
  "unit",
  "distribution",
  "assumption",
  "contribution",
  "sensitivity",
  "mean",
  "standardDeviation",
  "cpk",
  "assemblyDirection",
  "partName",
  "partCategory",
  "longTermSafetyFactor",
  "drawingNumber",
  "dimCharacteristicId",
]);

const worksheetSourceCellSchema = z.string().regex(/^[^!]+![A-Z]+[1-9]\d*$/);

const availableWorksheetFieldSchema = z
  .object({
    status: z.literal("available"),
    rawText: z.string(),
    sourceCell: worksheetSourceCellSchema,
    numericValue: z.number().finite().optional(),
    unit: z.string().min(1).optional(),
    formula: z.string().min(1).optional(),
    cachedValue: z.string().optional(),
  })
  .strict()
  .refine((field) => !field.formula || field.cachedValue !== undefined, {
    message: "cachedValue is required when formula is present",
    path: ["cachedValue"],
  });

const unavailableWorksheetFieldSchema = z
  .object({
    status: z.literal("unavailable"),
    reasonCode: z.enum([
      "missing",
      "duplicate_mapping",
      "invalid_format",
      "ambiguous_mapping",
      "missing_cached_value",
    ]),
    sourceCell: worksheetSourceCellSchema.optional(),
  })
  .strict();

const worksheetFieldSchema = z.union([
  availableWorksheetFieldSchema,
  unavailableWorksheetFieldSchema,
]);

const formulaCachedValueSchema = z.union([
  z.object({ status: z.literal("available"), rawText: z.string() }).strict(),
  z
    .object({
      status: z.literal("unavailable"),
      reasonCode: z.literal("missing_cached_value"),
    })
    .strict(),
]);

const imageAnchorSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("available"),
      from: z.string().regex(/^[A-Z]+[1-9]\d*$/),
      to: z.string().regex(/^[A-Z]+[1-9]\d*$/),
    })
    .strict(),
  z
    .object({
      status: z.literal("unavailable"),
      reasonCode: z.literal("unparsed_anchor"),
    })
    .strict(),
]);

  const worksheetImageMediaTypeSchema = z.string().regex(/^(?:image\/[a-z0-9.+-]+|application\/octet-stream)$/);

const factorTableSchema = z
  .object({
    tableId: z.string().min(1),
    headerRow: z.number().int().positive(),
    dataRange: z
      .object({
        startRow: z.number().int().positive(),
        endRow: z.number().int().positive(),
      })
      .strict()
      .refine((range) => range.startRow <= range.endRow, {
        message: "dataRange startRow must not exceed endRow",
        path: ["startRow"],
      }),
    columns: z
      .array(
        z
          .object({
            semanticField: worksheetFieldNameSchema,
            headerText: z.string().min(1),
            sourceColumn: z.string().regex(/^[A-Z]+$/),
          })
          .strict(),
      )
      .min(1),
    rows: z.array(
      z
        .object({
          sourceRow: z.number().int().positive(),
          fields: z.record(worksheetFieldNameSchema, worksheetFieldSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const worksheetAnalysisAssetsResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    workbook: z
      .object({
        classification: z.literal("confidential"),
        contentHash: sha256Schema,
        catalogContractVersion: contractVersionSchema,
      })
      .strict(),
    worksheets: z.array(
      z
        .object({
          worksheetName: z.string().min(1),
          toleranceLoopDescription: z.string().min(1),
          factorTables: z.array(factorTableSchema),
          formulaCells: z.array(
            z
              .object({
                sourceCell: worksheetSourceCellSchema,
                formula: z.string().min(1),
                cachedValue: formulaCachedValueSchema,
              })
              .strict(),
          ),
          imageAssets: z.array(
            z
              .object({
                contentHash: sha256Schema,
                mediaType: worksheetImageMediaTypeSchema,
                byteLength: z.number().int().positive(),
                sourcePart: z.string().min(1),
                drawingSourcePart: z.string().min(1),
                anchor: imageAnchorSchema,
              })
              .strict(),
          ),
        })
        .strict(),
    ).min(1),
  })
  .strict();

const semanticDetectionReasonCodeSchema = z.enum([
  "missing_required_field",
  "duplicate_mapping",
  "ambiguous_mapping",
  "invalid_format",
  "invalid_manual_confirmation",
  "no_candidate_detected",
]);

const semanticDetectionRecommendedActionSchema = z.enum([
  "confirm_as_is",
  "remap_fields",
  "select_another_candidate",
  "skip_sheet",
]);

const semanticDetectionFieldNameSchema = z.enum([
  "factorName",
  "partName",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "distribution",
  "drawingNumber",
  "dimCharacteristicId",
]);

const semanticDetectionFieldMappingSchema = z
  .object({
    field: semanticDetectionFieldNameSchema,
    sourceColumn: z.string().regex(/^[A-Z]+$/).optional(),
    headerText: z.string().min(1).optional(),
    status: z.enum(["mapped", "missing", "duplicate", "ambiguous"]),
  })
  .strict();

const semanticDetectionConfidenceBreakdownSchema = z
  .object({
    headerScore: z.number().int().min(0).max(45),
    typeScore: z.number().int().min(0).max(25),
    completenessScore: z.number().int().min(0).max(20),
    penalty: z.number().int().min(0).max(30),
  })
  .strict();

const semanticDetectionDataRangeSchema = z
  .object({
    startRow: z.number().int().positive(),
    endRow: z.number().int().positive(),
  })
  .strict()
  .refine((range) => range.startRow <= range.endRow, {
    message: "dataRange startRow must not exceed endRow",
    path: ["startRow"],
  });

const semanticDetectionConfirmationPayloadSchema = z
  .object({
    candidateId: z.string().min(1),
    headerRow: z.number().int().positive(),
    dataRange: semanticDetectionDataRangeSchema,
    mappedFields: z.array(semanticDetectionFieldMappingSchema),
    recommendedAction: semanticDetectionRecommendedActionSchema,
    reasonCodes: z.array(semanticDetectionReasonCodeSchema),
  })
  .strict();

const semanticDetectionWorksheetResultSchema = z
  .object({
    worksheetName: z.string().min(1),
    recognitionStatus: z.enum([
      "auto_confirmed",
      "pending_confirmation",
      "manual_confirmed",
      "blocked",
    ]),
    confidenceScore: z.number().int().min(0).max(100),
    confidenceBreakdown: semanticDetectionConfidenceBreakdownSchema,
    uncertaintyReasons: z.array(semanticDetectionReasonCodeSchema),
    requiresUserConfirmation: z.boolean(),
    confirmationPayload: semanticDetectionConfirmationPayloadSchema.optional(),
  })
  .strict();

const semanticDetectionManualConfirmationSchema = z
  .object({
    worksheetName: z.string().min(1),
    candidateId: z.string().min(1),
    action: semanticDetectionRecommendedActionSchema,
  })
  .strict();

export const semanticTableDetectionRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    workbookBytes: nonEmptyWorkbookBytesSchema,
    workbookCatalog: workbookCatalogResultSchema,
    worksheetSelection: worksheetSelectionSchema.optional(),
    manualConfirmations: z.array(semanticDetectionManualConfirmationSchema).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.worksheetSelection?.mode === "selected"
      && new Set(request.worksheetSelection.worksheetNames).size !== request.worksheetSelection.worksheetNames.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheetNames must be unique",
        path: ["worksheetSelection", "worksheetNames"],
      });
    }
  });

export const semanticTableDetectionResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    workbook: z
      .object({
        contentHash: sha256Schema,
        catalogContractVersion: contractVersionSchema,
      })
      .strict(),
    worksheets: z.array(semanticDetectionWorksheetResultSchema).min(1),
    summary: z
      .object({
        worksheetCount: z.number().int().nonnegative(),
        autoConfirmedCount: z.number().int().nonnegative(),
        manualConfirmedCount: z.number().int().nonnegative(),
        pendingConfirmationCount: z.number().int().nonnegative(),
        blockedCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .superRefine((result, context) => {
    const autoConfirmedCount = result.worksheets.filter((worksheet) => worksheet.recognitionStatus === "auto_confirmed").length;
    const manualConfirmedCount = result.worksheets.filter((worksheet) => worksheet.recognitionStatus === "manual_confirmed").length;
    const pendingConfirmationCount = result.worksheets.filter((worksheet) => worksheet.recognitionStatus === "pending_confirmation").length;
    const blockedCount = result.worksheets.filter((worksheet) => worksheet.recognitionStatus === "blocked").length;

    if (result.summary.worksheetCount !== result.worksheets.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheetCount must match worksheets length",
        path: ["summary", "worksheetCount"],
      });
    }
    if (result.summary.autoConfirmedCount !== autoConfirmedCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "autoConfirmedCount must match worksheets",
        path: ["summary", "autoConfirmedCount"],
      });
    }
    if (result.summary.manualConfirmedCount !== manualConfirmedCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "manualConfirmedCount must match worksheets",
        path: ["summary", "manualConfirmedCount"],
      });
    }
    if (result.summary.pendingConfirmationCount !== pendingConfirmationCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pendingConfirmationCount must match worksheets",
        path: ["summary", "pendingConfirmationCount"],
      });
    }
    if (result.summary.blockedCount !== blockedCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "blockedCount must match worksheets",
        path: ["summary", "blockedCount"],
      });
    }

    for (const [index, worksheet] of result.worksheets.entries()) {
      if ((worksheet.recognitionStatus === "pending_confirmation" || worksheet.recognitionStatus === "blocked") && !worksheet.requiresUserConfirmation) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "requiresUserConfirmation must be true for pending_confirmation or blocked",
          path: ["worksheets", index, "requiresUserConfirmation"],
        });
      }
      if ((worksheet.recognitionStatus === "pending_confirmation" || worksheet.recognitionStatus === "blocked") && worksheet.confirmationPayload === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "confirmationPayload is required for pending_confirmation or blocked",
          path: ["worksheets", index, "confirmationPayload"],
        });
      }
      if ((worksheet.recognitionStatus === "auto_confirmed" || worksheet.recognitionStatus === "manual_confirmed") && worksheet.requiresUserConfirmation) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "requiresUserConfirmation must be false for confirmed status",
          path: ["worksheets", index, "requiresUserConfirmation"],
        });
      }
    }
  });

const requiredFieldNameSchema = z.enum([
  "factorName",
  "partName",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "standardDeviation",
  "distribution",
]);
const optionalIdentifierFieldNameSchema = z.enum(["drawingNumber", "dimCharacteristicId"]);
const worksheetUnavailableReasonCodeSchema = z.enum([
  "missing",
  "duplicate_mapping",
  "invalid_format",
  "ambiguous_mapping",
  "missing_cached_value",
]);

export const requiredFieldCheckRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    worksheetAnalysisAssets: worksheetAnalysisAssetsResultSchema,
  })
  .strict();

const requiredFieldUnavailableIssueSchema = z
  .object({
    issueCode: z.literal("required_field_unavailable"),
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    field: requiredFieldNameSchema,
    reasonCode: worksheetUnavailableReasonCodeSchema,
    sourceCell: worksheetSourceCellSchema.optional(),
  })
  .strict();
const emptyFactorTableIssueSchema = z
  .object({
    issueCode: z.literal("factor_table_has_no_rows"),
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
  })
  .strict();
const optionalIdentifierUnavailableIssueSchema = z
  .object({
    issueCode: z.literal("optional_identifier_unavailable"),
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    field: optionalIdentifierFieldNameSchema,
    reasonCode: worksheetUnavailableReasonCodeSchema,
    sourceCell: worksheetSourceCellSchema.optional(),
  })
  .strict();

export const requiredFieldCheckResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    workbookContentHash: sha256Schema,
    status: z.enum(["blocked", "readyForNextCheck"]),
    blockingIssues: z.array(z.discriminatedUnion("issueCode", [
      requiredFieldUnavailableIssueSchema,
      emptyFactorTableIssueSchema,
    ])),
    advisoryIssues: z.array(optionalIdentifierUnavailableIssueSchema),
    summary: z
      .object({
        worksheetsChecked: z.number().int().nonnegative(),
        factorTablesChecked: z.number().int().nonnegative(),
        factorRowsChecked: z.number().int().nonnegative(),
        blockingIssueCount: z.number().int().nonnegative(),
        advisoryIssueCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .superRefine((result, context) => {
    if ((result.status === "blocked") !== (result.blockingIssues.length > 0)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "status must match blocking issues", path: ["status"] });
    }
    if (result.summary.blockingIssueCount !== result.blockingIssues.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "blocking issue count must match", path: ["summary", "blockingIssueCount"] });
    }
    if (result.summary.advisoryIssueCount !== result.advisoryIssues.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "advisory issue count must match", path: ["summary", "advisoryIssueCount"] });
    }
  });

const identifierQualityFieldSchema = z.enum(["drawingNumber", "dimCharacteristicId"]);

export const identifierQualityCheckRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    worksheetAnalysisAssets: worksheetAnalysisAssetsResultSchema,
    requiredFieldCheck: requiredFieldCheckResultSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.worksheetAnalysisAssets.workbook.contentHash !== request.requiredFieldCheck.workbookContentHash) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheet-analysis assets and required-field check must share a workbook hash",
        path: ["requiredFieldCheck", "workbookContentHash"],
      });
    }
  });

const identifierQualitySignalSourceSchema = z
  .object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    field: identifierQualityFieldSchema,
    sourceRows: z.array(z.number().int().positive()).min(1),
  })
  .strict();

const identifierQualitySignalSchema = z
  .discriminatedUnion("signalKind", [
    identifierQualitySignalSourceSchema.extend({ signalKind: z.literal("identifier_missing") }).strict(),
    identifierQualitySignalSourceSchema.extend({
      signalKind: z.literal("identifier_evidence_unavailable"),
      reasonCode: worksheetUnavailableReasonCodeSchema,
    }).strict(),
    identifierQualitySignalSourceSchema.extend({ signalKind: z.literal("identifier_text_invalid") }).strict(),
    identifierQualitySignalSourceSchema.extend({
      signalKind: z.literal("dim_id_duplicate"),
      field: z.literal("dimCharacteristicId"),
      normalizedDimId: z.string().min(1),
    }).strict(),
  ])
  .superRefine((signal, context) => {
    if (new Set(signal.sourceRows).size !== signal.sourceRows.length
      || signal.sourceRows.some((sourceRow, index) => index > 0 && sourceRow <= signal.sourceRows[index - 1]!)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "sourceRows must be unique and ascending", path: ["sourceRows"] });
    }
  });

const identifierQualitySummarySchema = z
  .object({
    factorRowsChecked: z.number().int().nonnegative(),
    actionableSignalCount: z.number().int().nonnegative(),
    identifierMissingCount: z.number().int().nonnegative(),
    identifierEvidenceUnavailableCount: z.number().int().nonnegative(),
    identifierTextInvalidCount: z.number().int().nonnegative(),
    dimIdDuplicateCount: z.number().int().nonnegative(),
  })
  .strict();

const identifierQualityCheckResultBase = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  workbookContentHash: sha256Schema,
  signals: z.array(identifierQualitySignalSchema),
  summary: identifierQualitySummarySchema,
});

export const identifierQualityCheckResultSchema = z
  .discriminatedUnion("status", [
    identifierQualityCheckResultBase.extend({ status: z.literal("completed") }).strict(),
    identifierQualityCheckResultBase.extend({
      status: z.literal("required_fields_not_ready"),
      signals: z.array(identifierQualitySignalSchema).length(0),
    }).strict(),
  ])
  .superRefine((result, context) => {
    const counts = {
      actionableSignalCount: result.signals.length,
      identifierMissingCount: result.signals.filter((signal) => signal.signalKind === "identifier_missing").length,
      identifierEvidenceUnavailableCount: result.signals.filter((signal) => signal.signalKind === "identifier_evidence_unavailable").length,
      identifierTextInvalidCount: result.signals.filter((signal) => signal.signalKind === "identifier_text_invalid").length,
      dimIdDuplicateCount: result.signals.filter((signal) => signal.signalKind === "dim_id_duplicate").length,
    };
    for (const [field, expected] of Object.entries(counts)) {
      if (result.summary[field as keyof typeof counts] !== expected) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must match signals`, path: ["summary", field] });
      }
    }
    if (result.status === "required_fields_not_ready" && result.summary.factorRowsChecked !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "gate results must not count factor rows", path: ["summary", "factorRowsChecked"] });
    }
  });

export const capabilityValidationRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    knowledgeBaseVersion: knowledgeBaseVersionSchema,
    worksheetAnalysisAssets: worksheetAnalysisAssetsResultSchema,
    requiredFieldCheck: requiredFieldCheckResultSchema,
  })
  .strict();

const capabilityToleranceValidationSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("in_library"),
      totalTolerance: z.number().finite().nonnegative(),
      unit: z.literal("mm"),
      capabilityEntryId: z.string().min(1),
      capabilityTier: capabilityTierSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("out_of_library"),
      totalTolerance: z.number().finite().nonnegative(),
      unit: z.literal("mm"),
    })
    .strict(),
  z
    .object({
      status: z.literal("unable_to_validate"),
      reasonCode: z.enum(["unit_unavailable", "invalid_tolerance"]),
    })
    .strict(),
]);

const capabilityDistributionValidationSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("matches_recommendation"),
      actual: distributionSchema,
      recommended: distributionSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("distribution_mismatch"),
      actual: distributionSchema,
      recommended: distributionSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("unable_to_validate"),
      reasonCode: z.literal("distribution_unavailable"),
    })
    .strict(),
  z.object({ status: z.literal("not_applicable") }).strict(),
]);

const capabilityValidationRowSchema = z
  .object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    factorName: z.string().min(1),
    tolerance: capabilityToleranceValidationSchema,
    distribution: capabilityDistributionValidationSchema,
  })
  .strict();

const capabilityValidationSummarySchema = z
  .object({
    factorRowsChecked: z.number().int().nonnegative(),
    inLibraryCount: z.number().int().nonnegative(),
    outOfLibraryCount: z.number().int().nonnegative(),
    toleranceUnableToValidateCount: z.number().int().nonnegative(),
    distributionMatchCount: z.number().int().nonnegative(),
    distributionMismatchCount: z.number().int().nonnegative(),
    distributionUnableToValidateCount: z.number().int().nonnegative(),
    distributionNotApplicableCount: z.number().int().nonnegative(),
  })
  .strict();

const capabilityValidationResultBase = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  knowledgeBaseVersion: knowledgeBaseVersionSchema,
  workbookContentHash: sha256Schema,
});

export const capabilityValidationResultSchema = z
  .discriminatedUnion("status", [
    capabilityValidationResultBase.extend({
      status: z.literal("completed"),
      rows: z.array(capabilityValidationRowSchema),
      summary: capabilityValidationSummarySchema,
    }).strict(),
    capabilityValidationResultBase.extend({
      status: z.literal("required_fields_not_ready"),
      rows: z.array(capabilityValidationRowSchema).length(0),
      summary: capabilityValidationSummarySchema,
    }).strict(),
  ])
  .superRefine((result, context) => {
    const summary = result.summary;
    const counts = {
      factorRowsChecked: result.rows.length,
      inLibraryCount: result.rows.filter((row) => row.tolerance.status === "in_library").length,
      outOfLibraryCount: result.rows.filter((row) => row.tolerance.status === "out_of_library").length,
      toleranceUnableToValidateCount: result.rows.filter((row) => row.tolerance.status === "unable_to_validate").length,
      distributionMatchCount: result.rows.filter((row) => row.distribution.status === "matches_recommendation").length,
      distributionMismatchCount: result.rows.filter((row) => row.distribution.status === "distribution_mismatch").length,
      distributionUnableToValidateCount: result.rows.filter((row) => row.distribution.status === "unable_to_validate").length,
      distributionNotApplicableCount: result.rows.filter((row) => row.distribution.status === "not_applicable").length,
    };
    for (const [field, expected] of Object.entries(counts)) {
      if (summary[field as keyof typeof summary] !== expected) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must match row outcomes`,
          path: ["summary", field],
        });
      }
    }
  });

const utcTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "timestamp must be a valid UTC ISO-8601 value",
  });

const exceptionSignalSourceSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  factorName: z.string().min(1),
});

const exceptionSignalSnapshotSchema = z.discriminatedUnion("signalKind", [
  exceptionSignalSourceSchema.extend({
    signalKind: z.literal("tolerance_out_of_library"),
    signal: z.object({
      status: z.literal("out_of_library"),
      totalTolerance: z.number().finite().nonnegative(),
      unit: z.literal("mm"),
    }).strict(),
  }).strict(),
  exceptionSignalSourceSchema.extend({
    signalKind: z.literal("tolerance_unable_to_validate"),
    signal: z.object({
      status: z.literal("unable_to_validate"),
      reasonCode: z.enum(["unit_unavailable", "invalid_tolerance"]),
    }).strict(),
  }).strict(),
  exceptionSignalSourceSchema.extend({
    signalKind: z.literal("distribution_mismatch"),
    signal: z.object({
      status: z.literal("distribution_mismatch"),
      actual: distributionSchema,
      recommended: distributionSchema,
    }).strict(),
  }).strict(),
  exceptionSignalSourceSchema.extend({
    signalKind: z.literal("distribution_unable_to_validate"),
    signal: z.object({
      status: z.literal("unable_to_validate"),
      reasonCode: z.literal("distribution_unavailable"),
    }).strict(),
  }).strict(),
]);

const exceptionCandidateSubmissionSchema = z.object({
  signalRef: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string(),
  rationale: z.string(),
}).strict();

const acceptedExceptionSchema = z.object({
  signalRef: z.string().min(1),
  recordedBy: z.string().trim().min(1),
  recordedAt: utcTimestampSchema,
  rationale: z.string().trim().min(1),
  snapshot: exceptionSignalSnapshotSchema,
}).strict();

const pendingExceptionSchema = z.object({
  signalRef: z.string().min(1),
  reasonCode: z.enum(["missing_candidate", "duplicate_candidate", "invalid_candidate"]),
  snapshot: exceptionSignalSnapshotSchema,
}).strict();

export const exceptionResolutionRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    capabilityValidation: capabilityValidationResultSchema,
    candidates: z.array(exceptionCandidateSubmissionSchema),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.capabilityValidation.status !== "completed") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "capability validation must be completed",
        path: ["capabilityValidation", "status"],
      });
    }
  });

const exceptionResolutionSummarySchema = z.object({
  actionableSignalCount: z.number().int().nonnegative(),
  acceptedExceptionCount: z.number().int().nonnegative(),
  pendingExceptionCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(),
}).strict();

const exceptionResolutionResultBase = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  workbookContentHash: sha256Schema,
  knowledgeBaseVersion: knowledgeBaseVersionSchema,
  acceptedExceptions: z.array(acceptedExceptionSchema),
  pendingExceptions: z.array(pendingExceptionSchema),
  summary: exceptionResolutionSummarySchema,
});

export const exceptionResolutionResultSchema = z
  .discriminatedUnion("status", [
    exceptionResolutionResultBase.extend({
      status: z.literal("readyToContinue"),
      readyToContinue: z.literal(true),
    }).strict(),
    exceptionResolutionResultBase.extend({
      status: z.literal("pendingExceptions"),
      readyToContinue: z.literal(false),
    }).strict(),
  ])
  .superRefine((result, context) => {
    const acceptedRefs = result.acceptedExceptions.map((entry) => entry.signalRef);
    const pendingRefs = result.pendingExceptions.map((entry) => entry.signalRef);
    const acceptedRefSet = new Set(acceptedRefs);
    const pendingRefSet = new Set(pendingRefs);
    const summary = result.summary;

    if (summary.acceptedExceptionCount !== result.acceptedExceptions.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "accepted exception count must match records", path: ["summary", "acceptedExceptionCount"] });
    }
    if (summary.pendingExceptionCount !== result.pendingExceptions.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "pending exception count must match records", path: ["summary", "pendingExceptionCount"] });
    }
    if (summary.actionableSignalCount !== result.acceptedExceptions.length + result.pendingExceptions.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "actionable signal count must match records", path: ["summary", "actionableSignalCount"] });
    }
    if (acceptedRefSet.size !== acceptedRefs.length || pendingRefSet.size !== pendingRefs.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "signal references must be unique", path: ["acceptedExceptions"] });
    }
    if (acceptedRefs.some((signalRef) => pendingRefSet.has(signalRef))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "accepted and pending signal references must not overlap", path: ["pendingExceptions"] });
    }
    const isReady = result.pendingExceptions.length === 0 && summary.invalidCandidateCount === 0;
    if ((result.status === "readyToContinue") !== isReady) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "status must match pending and invalid candidates", path: ["status"] });
    }
  });

const contractVersionV2Schema = z.literal("v2");

const unifiedCapabilitySignalSourceSchema = z.object({
  source: z.literal("capability_validation"),
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  factorName: z.string().min(1),
});

const unifiedCapabilitySignalSnapshotSchema = z.discriminatedUnion("signalKind", [
  unifiedCapabilitySignalSourceSchema.extend({
    signalKind: z.literal("tolerance_out_of_library"),
    signal: z.object({
      status: z.literal("out_of_library"),
      totalTolerance: z.number().finite().nonnegative(),
      unit: z.literal("mm"),
    }).strict(),
  }).strict(),
  unifiedCapabilitySignalSourceSchema.extend({
    signalKind: z.literal("tolerance_unable_to_validate"),
    signal: z.object({
      status: z.literal("unable_to_validate"),
      reasonCode: z.enum(["unit_unavailable", "invalid_tolerance"]),
    }).strict(),
  }).strict(),
  unifiedCapabilitySignalSourceSchema.extend({
    signalKind: z.literal("distribution_mismatch"),
    signal: z.object({
      status: z.literal("distribution_mismatch"),
      actual: distributionSchema,
      recommended: distributionSchema,
    }).strict(),
  }).strict(),
  unifiedCapabilitySignalSourceSchema.extend({
    signalKind: z.literal("distribution_unable_to_validate"),
    signal: z.object({
      status: z.literal("unable_to_validate"),
      reasonCode: z.literal("distribution_unavailable"),
    }).strict(),
  }).strict(),
]);

const unifiedIdentifierSignalSourceSchema = z.object({
  source: z.literal("identifier_quality"),
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  field: identifierQualityFieldSchema,
  sourceRows: z.array(z.number().int().positive()).min(1),
});

const unifiedIdentifierSignalSnapshotSchema = z.discriminatedUnion("signalKind", [
  unifiedIdentifierSignalSourceSchema.extend({ signalKind: z.literal("identifier_missing") }).strict(),
  unifiedIdentifierSignalSourceSchema.extend({
    signalKind: z.literal("identifier_evidence_unavailable"),
    reasonCode: worksheetUnavailableReasonCodeSchema,
  }).strict(),
  unifiedIdentifierSignalSourceSchema.extend({ signalKind: z.literal("identifier_text_invalid") }).strict(),
  unifiedIdentifierSignalSourceSchema.extend({
    signalKind: z.literal("dim_id_duplicate"),
    field: z.literal("dimCharacteristicId"),
    normalizedDimId: z.string().min(1),
  }).strict(),
]);

const unifiedExceptionSignalSnapshotSchema = z.union([
  unifiedCapabilitySignalSnapshotSchema,
  unifiedIdentifierSignalSnapshotSchema,
]);

const unifiedExceptionCandidateSubmissionSchema = z.object({
  signalRef: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string(),
  rationale: z.string(),
}).strict();

const unifiedAcceptedExceptionSchema = z.object({
  signalRef: z.string().min(1),
  recordedBy: z.string().trim().min(1),
  recordedAt: utcTimestampSchema,
  rationale: z.string().trim().min(1),
  snapshot: unifiedExceptionSignalSnapshotSchema,
}).strict();

const unifiedPendingExceptionSchema = z.object({
  signalRef: z.string().min(1),
  reasonCode: z.enum(["missing_candidate", "duplicate_candidate", "invalid_candidate"]),
  snapshot: unifiedExceptionSignalSnapshotSchema,
}).strict();

export const unifiedExceptionResolutionV2RequestSchema = z
  .object({
    contractVersion: contractVersionV2Schema,
    inputClassification: z.literal("confidential"),
    capabilityValidation: capabilityValidationResultSchema,
    identifierQualityCheck: identifierQualityCheckResultSchema,
    candidates: z.array(unifiedExceptionCandidateSubmissionSchema),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.capabilityValidation.status !== "completed") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "capability validation must be completed", path: ["capabilityValidation", "status"] });
    }
    if (request.identifierQualityCheck.status !== "completed") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "identifier quality check must be completed", path: ["identifierQualityCheck", "status"] });
    }
    if (request.capabilityValidation.workbookContentHash !== request.identifierQualityCheck.workbookContentHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "validation inputs must share a workbook hash", path: ["identifierQualityCheck", "workbookContentHash"] });
    }
  });

const unifiedExceptionResolutionV2SummarySchema = z.object({
  actionableSignalCount: z.number().int().nonnegative(),
  capabilitySignalCount: z.number().int().nonnegative(),
  identifierSignalCount: z.number().int().nonnegative(),
  acceptedExceptionCount: z.number().int().nonnegative(),
  acceptedCapabilityExceptionCount: z.number().int().nonnegative(),
  acceptedIdentifierExceptionCount: z.number().int().nonnegative(),
  pendingExceptionCount: z.number().int().nonnegative(),
  pendingCapabilityExceptionCount: z.number().int().nonnegative(),
  pendingIdentifierExceptionCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(),
}).strict();

const unifiedExceptionResolutionV2ResultBase = z.object({
  contractVersion: contractVersionV2Schema,
  inputClassification: z.literal("confidential"),
  workbookContentHash: sha256Schema,
  knowledgeBaseVersion: knowledgeBaseVersionSchema,
  acceptedExceptions: z.array(unifiedAcceptedExceptionSchema),
  pendingExceptions: z.array(unifiedPendingExceptionSchema),
  summary: unifiedExceptionResolutionV2SummarySchema,
});

export const unifiedExceptionResolutionV2ResultSchema = z
  .discriminatedUnion("status", [
    unifiedExceptionResolutionV2ResultBase.extend({
      status: z.literal("readyToContinue"),
      readyToContinue: z.literal(true),
    }).strict(),
    unifiedExceptionResolutionV2ResultBase.extend({
      status: z.literal("pendingExceptions"),
      readyToContinue: z.literal(false),
    }).strict(),
  ])
  .superRefine((result, context) => {
    const acceptedRefs = result.acceptedExceptions.map((entry) => entry.signalRef);
    const pendingRefs = result.pendingExceptions.map((entry) => entry.signalRef);
    const acceptedRefSet = new Set(acceptedRefs);
    const pendingRefSet = new Set(pendingRefs);
    const acceptedCapabilityCount = result.acceptedExceptions.filter((entry) => entry.snapshot.source === "capability_validation").length;
    const pendingCapabilityCount = result.pendingExceptions.filter((entry) => entry.snapshot.source === "capability_validation").length;
    const acceptedIdentifierCount = result.acceptedExceptions.length - acceptedCapabilityCount;
    const pendingIdentifierCount = result.pendingExceptions.length - pendingCapabilityCount;
    const summary = result.summary;

    const expectedCounts = {
      actionableSignalCount: result.acceptedExceptions.length + result.pendingExceptions.length,
      capabilitySignalCount: acceptedCapabilityCount + pendingCapabilityCount,
      identifierSignalCount: acceptedIdentifierCount + pendingIdentifierCount,
      acceptedExceptionCount: result.acceptedExceptions.length,
      acceptedCapabilityExceptionCount: acceptedCapabilityCount,
      acceptedIdentifierExceptionCount: acceptedIdentifierCount,
      pendingExceptionCount: result.pendingExceptions.length,
      pendingCapabilityExceptionCount: pendingCapabilityCount,
      pendingIdentifierExceptionCount: pendingIdentifierCount,
    };
    for (const [field, expected] of Object.entries(expectedCounts)) {
      if (summary[field as keyof typeof expectedCounts] !== expected) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must match exception records`, path: ["summary", field] });
      }
    }
    if (acceptedRefSet.size !== acceptedRefs.length || pendingRefSet.size !== pendingRefs.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "signal references must be unique", path: ["acceptedExceptions"] });
    }
    if (acceptedRefs.some((signalRef) => pendingRefSet.has(signalRef))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "accepted and pending signal references must not overlap", path: ["pendingExceptions"] });
    }
    const isReady = result.pendingExceptions.length === 0 && summary.invalidCandidateCount === 0;
    if ((result.status === "readyToContinue") !== isReady) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "status must match pending and invalid candidates", path: ["status"] });
    }
  });

const controlledCalculationReferenceSchema = z.string().min(1);

const calculationWorksheetSelectionSchema = z
  .object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
  })
  .strict();

const calculationSystemSpecificationSchema = z
  .object({
    designNominal: z.number().finite(),
    lowerSpecLimit: z.number().finite(),
    upperSpecLimit: z.number().finite(),
    targetSigmaLevel: z.number().finite().positive(),
    targetCpk: z.number().finite().positive(),
    additionalMeanShift: z.number().finite(),
  })
  .strict()
  .refine((value) => value.upperSpecLimit > value.lowerSpecLimit, {
    message: "upperSpecLimit must be greater than lowerSpecLimit",
    path: ["upperSpecLimit"],
  });

export const calculationCriticalitySchema = z.enum(["none", "CTS", "CTF"]);

const calculationFactorOverrideSchema = z
  .object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    nominalValue: z.number().finite().optional(),
    upperTolerance: z.number().finite().optional(),
    lowerTolerance: z.number().finite().optional(),
    longTermSafetyFactor: z.number().finite().positive().optional(),
    sigmaLevel: z.number().finite().positive().optional(),
    distribution: distributionSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasOverride = value.nominalValue !== undefined
      || value.upperTolerance !== undefined
      || value.lowerTolerance !== undefined
      || value.longTermSafetyFactor !== undefined
      || value.sigmaLevel !== undefined
      || value.distribution !== undefined;
    if (!hasOverride) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "factor override must include at least one override value",
      });
    }
  });

const calculationScenarioSystemSpecificationSchema = z
  .object({
    lowerSpecLimit: z.number().finite().optional(),
    upperSpecLimit: z.number().finite().optional(),
    targetSigmaLevel: z.number().finite().positive().optional(),
    targetCpk: z.number().finite().positive().optional(),
    additionalMeanShift: z.number().finite().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasOverride = value.lowerSpecLimit !== undefined
      || value.upperSpecLimit !== undefined
      || value.targetSigmaLevel !== undefined
      || value.targetCpk !== undefined
      || value.additionalMeanShift !== undefined;
    if (!hasOverride) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "systemSpecification must include at least one override value",
      });
    }
  });

export const calculationScenarioOverrideSchema = z
  .object({
    scenarioId: z.string().min(1),
    factorOverrides: z.array(calculationFactorOverrideSchema).max(100),
    systemSpecification: calculationScenarioSystemSpecificationSchema.optional(),
  })
  .strict()
  .superRefine((scenario, context) => {
    if (scenario.factorOverrides.length === 0 && scenario.systemSpecification === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scenario override must include at least one factor override or systemSpecification override",
      });
    }
  });

export const calculationUnavailableRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    projectReference: controlledCalculationReferenceSchema,
    runReference: controlledCalculationReferenceSchema,
    worksheetReferences: z.array(controlledCalculationReferenceSchema),
  })
  .strict();

export const calculationRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    projectReference: controlledCalculationReferenceSchema,
    runReference: controlledCalculationReferenceSchema,
    worksheetAnalysisAssets: worksheetAnalysisAssetsResultSchema,
    requiredFieldCheck: requiredFieldCheckResultSchema,
    exceptionResolution: exceptionResolutionResultSchema,
    worksheetSelection: calculationWorksheetSelectionSchema,
    systemSpecification: calculationSystemSpecificationSchema,
    criticality: calculationCriticalitySchema,
    scenarioOverrides: z.array(calculationScenarioOverrideSchema).max(100),
  })
  .strict()
  .superRefine((request, context) => {
    const workbookHash = request.worksheetAnalysisAssets.workbook.contentHash;
    if (request.requiredFieldCheck.workbookContentHash !== workbookHash) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheet-analysis assets and required-field check must share a workbook hash",
        path: ["requiredFieldCheck", "workbookContentHash"],
      });
    }
    if (request.exceptionResolution.workbookContentHash !== workbookHash) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheet-analysis assets and exception resolution must share a workbook hash",
        path: ["exceptionResolution", "workbookContentHash"],
      });
    }
    if (request.requiredFieldCheck.status !== "readyForNextCheck") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "requiredFieldCheck must be readyForNextCheck",
        path: ["requiredFieldCheck", "status"],
      });
    }
    if (request.exceptionResolution.status !== "readyToContinue") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exceptionResolution must be readyToContinue",
        path: ["exceptionResolution", "status"],
      });
    }

    const scenarioIds = request.scenarioOverrides.map((scenario) => scenario.scenarioId);
    if (new Set(scenarioIds).size !== scenarioIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scenarioId must be unique",
        path: ["scenarioOverrides"],
      });
    }

    for (const [scenarioIndex, scenario] of request.scenarioOverrides.entries()) {
      const overrideKeys = scenario.factorOverrides.map((override) => JSON.stringify([
        override.worksheetName,
        override.tableId,
        override.sourceRow,
      ]));
      if (new Set(overrideKeys).size !== overrideKeys.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "factor override keys must be unique within a scenario",
          path: ["scenarioOverrides", scenarioIndex, "factorOverrides"],
        });
      }

      const effectiveLowerSpecLimit = scenario.systemSpecification?.lowerSpecLimit ?? request.systemSpecification.lowerSpecLimit;
      const effectiveUpperSpecLimit = scenario.systemSpecification?.upperSpecLimit ?? request.systemSpecification.upperSpecLimit;
      if (effectiveUpperSpecLimit <= effectiveLowerSpecLimit) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "effective upperSpecLimit must be greater than lowerSpecLimit",
          path: ["scenarioOverrides", scenarioIndex, "systemSpecification", "upperSpecLimit"],
        });
      }
    }
  });

export const calculationMethodSchema = z.enum([
  "worst_case",
  "rss_1d",
  "refer_3d_variation_analysis",
]);

const calculationRecommendationReasonSchema = z.enum([
  "factor_count_1_to_3",
  "factor_count_4_to_10",
  "factor_count_over_10",
]);

const calculationRecommendationSchema = z
  .object({
    method: calculationMethodSchema,
    reason: calculationRecommendationReasonSchema,
    refer3d: z.boolean(),
    criticality: calculationCriticalitySchema,
    criticalityRisk: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.criticalityRisk !== (value.criticality !== "none")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "criticalityRisk must equal (criticality !== none)",
        path: ["criticalityRisk"],
      });
    }
  });

const calculationFactorSourceSchema = z
  .object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
  })
  .strict();

const calculationFactorInputSchema = z
  .object({
    nominalValue: z.number().finite(),
    upperTolerance: z.number().finite(),
    lowerTolerance: z.number().finite(),
    longTermSafetyFactor: z.number().finite().positive(),
    sigmaLevel: z.number().finite().positive(),
    distribution: distributionSchema,
  })
  .strict();

const calculationFactorTraceSchema = z
  .object({
    formulaIds: z.array(z.string().min(1)).min(1),
    sourceCells: z.array(z.string().min(1)).min(1),
  })
  .strict();

const calculationFactorResultSchema = z
  .object({
    factorName: z.string().min(1),
    unit: z.string().min(1),
    source: calculationFactorSourceSchema,
    input: calculationFactorInputSchema,
    mean: z.number().finite(),
    halfTolerance: z.number().finite(),
    sigma: z.number().finite(),
    contribution: z.number().finite().min(0).max(1),
    trace: calculationFactorTraceSchema,
  })
  .strict();

const calculationSystemResultSchema = z
  .object({
    designNominal: z.number().finite(),
    mean: z.number().finite(),
    additionalMeanShift: z.number().finite(),
    worstCaseUpper: z.number().finite(),
    worstCaseLower: z.number().finite(),
    rssSigma: z.number().finite(),
  })
  .strict();

const capabilityStatusSchema = z.enum(["PASS", "FAIL"]);

const calculationCapabilityResultSchema = z
  .object({
    lowerSpecLimit: z.number().finite(),
    upperSpecLimit: z.number().finite(),
    targetSigmaLevel: z.number().finite(),
    targetCpk: z.number().finite(),
    cp: z.number().finite(),
    lowerCpk: z.number().finite(),
    upperCpk: z.number().finite(),
    cpk: z.number().finite(),
    lowerZ: z.number().finite(),
    upperZ: z.number().finite(),
    lowerDpm: z.number().finite(),
    upperDpm: z.number().finite(),
    totalDpm: z.number().finite(),
    outOfSpecRatio: z.number().finite().min(0).max(1),
    yield: z.number().finite().min(0).max(1),
    status: capabilityStatusSchema,
  })
  .strict()
  .refine((value) => value.upperSpecLimit > value.lowerSpecLimit, {
    message: "upperSpecLimit must be greater than lowerSpecLimit",
    path: ["upperSpecLimit"],
  });

const calculationTraceRecordSchema = z
  .object({
    outputField: z.string().min(1),
    formulaVersion: z.literal("excel-ta-v1"),
    formulaId: z.enum([
      "factor-mean-v1",
      "factor-half-tolerance-v1",
      "factor-sigma-v1",
      "system-mean-v1",
      "worst-case-v1",
      "rss-v1",
      "contribution-v1",
      "cp-v1",
      "cpk-lower-v1",
      "cpk-upper-v1",
      "cpk-v1",
      "z-lower-v1",
      "z-upper-v1",
      "dpm-lower-v1",
      "dpm-upper-v1",
      "dpm-total-v1",
      "yield-v1",
      "status-v1",
    ]),
    sourceCells: z.array(z.string().min(1)).min(1),
  })
  .strict();

const calculationPayloadShape = {
  factorCount: z.number().int().positive(),
  recommendation: calculationRecommendationSchema,
  factors: z.array(calculationFactorResultSchema).min(1).max(100),
  system: calculationSystemResultSchema,
  capability: calculationCapabilityResultSchema,
  traceRecords: z.array(calculationTraceRecordSchema).min(1).max(500),
} as const;

const nearlyEqual = (left: number, right: number, tolerance = 1e-12): boolean => (
  Math.abs(left - right) <= tolerance * Math.max(1, Math.abs(left), Math.abs(right))
);

const validateCalculationPayload = (
  payload: z.infer<z.ZodObject<typeof calculationPayloadShape>>,
  context: z.RefinementCtx,
  pathPrefix: (string | number)[] = [],
): void => {
  const path = (segment: string | number): (string | number)[] => [...pathPrefix, segment];
  if (payload.factorCount !== payload.factors.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "factorCount must match factors length",
      path: path("factorCount"),
    });
  }

  if (payload.factorCount <= 3
    && (payload.recommendation.method !== "worst_case"
      || payload.recommendation.reason !== "factor_count_1_to_3"
      || payload.recommendation.refer3d)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "recommendation must match factor-count boundary for 1-3 factors",
      path: path("recommendation"),
    });
  }
  if (payload.factorCount >= 4 && payload.factorCount <= 10
    && (payload.recommendation.method !== "rss_1d"
      || payload.recommendation.reason !== "factor_count_4_to_10"
      || payload.recommendation.refer3d)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "recommendation must match factor-count boundary for 4-10 factors",
      path: path("recommendation"),
    });
  }
  if (payload.factorCount > 10
    && (payload.recommendation.method !== "refer_3d_variation_analysis"
      || payload.recommendation.reason !== "factor_count_over_10"
      || !payload.recommendation.refer3d)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "recommendation must match factor-count boundary for more than 10 factors",
      path: path("recommendation"),
    });
  }

  const expectedCpk = Math.min(payload.capability.lowerCpk, payload.capability.upperCpk);
  if (!nearlyEqual(payload.capability.cpk, expectedCpk)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "capability.cpk must equal min(lowerCpk, upperCpk)",
      path: path("capability").concat("cpk"),
    });
  }

  const expectedTotalDpm = payload.capability.lowerDpm + payload.capability.upperDpm;
  if (!nearlyEqual(payload.capability.totalDpm, expectedTotalDpm)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "capability.totalDpm must equal lowerDpm + upperDpm",
      path: path("capability").concat("totalDpm"),
    });
  }

  const expectedOutOfSpecRatio = payload.capability.totalDpm / 1_000_000;
  if (!nearlyEqual(payload.capability.outOfSpecRatio, expectedOutOfSpecRatio)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "capability.outOfSpecRatio must equal totalDpm / 1000000",
      path: path("capability").concat("outOfSpecRatio"),
    });
  }

  const expectedYield = 1 - expectedOutOfSpecRatio;
  if (!nearlyEqual(payload.capability.yield, expectedYield)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "capability.yield must equal 1 - outOfSpecRatio",
      path: path("capability").concat("yield"),
    });
  }
};

const calculationPayloadSchema = z
  .object(calculationPayloadShape)
  .strict()
  .superRefine((payload, context) => {
    validateCalculationPayload(payload, context);
  });

const calculationScenarioFactorOverrideDetailsSchema = z
  .object({
    source: calculationFactorSourceSchema,
    fields: z.array(z.enum([
      "nominalValue",
      "upperTolerance",
      "lowerTolerance",
      "longTermSafetyFactor",
      "sigmaLevel",
      "distribution",
    ])).min(1),
  })
  .strict();

const calculationScenarioOverridesSchema = z
  .object({
    factors: z.array(calculationScenarioFactorOverrideDetailsSchema).max(100),
    systemSpecification: calculationScenarioSystemSpecificationSchema.optional(),
  })
  .strict();

const calculationScenarioDeltasSchema = z
  .object({
    mean: z.number().finite(),
    rssSigma: z.number().finite(),
    worstCaseUpper: z.number().finite(),
    worstCaseLower: z.number().finite(),
    cpk: z.number().finite(),
    totalDpm: z.number().finite(),
    yield: z.number().finite(),
  })
  .strict();

const calculationScenarioResultEntrySchema = z
  .object({
    scenarioId: z.string().min(1),
    baselineRunReference: controlledCalculationReferenceSchema,
    calculation: calculationPayloadSchema,
    overrides: calculationScenarioOverridesSchema,
    deltas: calculationScenarioDeltasSchema,
  })
  .strict();

export const calculationCompletedResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F4"),
    status: z.literal("completed"),
    calculationVersion: z.literal("excel-ta-v1"),
    projectReference: controlledCalculationReferenceSchema,
    runReference: controlledCalculationReferenceSchema,
    workbookContentHash: sha256Schema,
    worksheetSelection: calculationWorksheetSelectionSchema,
    ...calculationPayloadShape,
    scenarios: z.array(calculationScenarioResultEntrySchema).max(100),
  })
  .strict()
  .superRefine((result, context) => {
    validateCalculationPayload(result, context);

    const scenarioIds = result.scenarios.map((scenario) => scenario.scenarioId);
    if (new Set(scenarioIds).size !== scenarioIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scenarioId must be unique",
        path: ["scenarios"],
      });
    }
  });

export const calculationLegacyUnavailableResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F4"),
    status: z.literal("feature_not_available"),
    projectReference: controlledCalculationReferenceSchema,
    runReference: controlledCalculationReferenceSchema,
    worksheetReferences: z.array(controlledCalculationReferenceSchema),
    requiredPrerequisites: z.tuple([
      z.literal("approved-template-regression"),
      z.literal("approved-windows-excel-worker"),
    ]),
  })
  .strict();

export const calculationResultSchema = z.union([
  calculationCompletedResultSchema,
  calculationLegacyUnavailableResultSchema,
]);

const controlledReferenceSchema = z.string().min(1);

export const drawingGovernanceRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    projectReference: controlledReferenceSchema,
    runReference: controlledReferenceSchema,
    worksheetReferences: z.array(controlledReferenceSchema),
  })
  .strict();

export const drawingGovernanceResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F3"),
    status: z.literal("feature_not_available"),
    projectReference: controlledReferenceSchema,
    runReference: controlledReferenceSchema,
    worksheetReferences: z.array(controlledReferenceSchema),
    requiredPrerequisites: z.tuple([
      z.literal("approved-ado-access"),
      z.literal("canonical-dim-id-policy"),
    ]),
  })
  .strict();

const controlledInterpretationReferenceSchema = z.string().min(1);

export const interpretationRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    projectReference: controlledInterpretationReferenceSchema,
    runReference: controlledInterpretationReferenceSchema,
    worksheetReferences: z.array(controlledInterpretationReferenceSchema),
  })
  .strict();

export const interpretationResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F5"),
    status: z.literal("feature_not_available"),
    projectReference: controlledInterpretationReferenceSchema,
    runReference: controlledInterpretationReferenceSchema,
    worksheetReferences: z.array(controlledInterpretationReferenceSchema),
    requiredPrerequisites: z.tuple([z.literal("approved-knowledge-base")]),
  })
  .strict();

const controlledComparisonReferenceSchema = z.string().min(1);

export const comparisonRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    projectReference: controlledComparisonReferenceSchema,
    runReference: controlledComparisonReferenceSchema,
    worksheetReferences: z.array(controlledComparisonReferenceSchema),
  })
  .strict();

export const comparisonResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F6"),
    status: z.literal("feature_not_available"),
    projectReference: controlledComparisonReferenceSchema,
    runReference: controlledComparisonReferenceSchema,
    worksheetReferences: z.array(controlledComparisonReferenceSchema),
    requiredPrerequisites: z.tuple([z.literal("approved-knowledge-base")]),
  })
  .strict();

const controlledCpkReferenceSchema = z.string().min(1);

export const cpkRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    projectReference: controlledCpkReferenceSchema,
    runReference: controlledCpkReferenceSchema,
    worksheetReferences: z.array(controlledCpkReferenceSchema),
  })
  .strict();

export const cpkResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F7"),
    status: z.literal("feature_not_available"),
    projectReference: controlledCpkReferenceSchema,
    runReference: controlledCpkReferenceSchema,
    worksheetReferences: z.array(controlledCpkReferenceSchema),
    requiredPrerequisites: z.tuple([z.literal("approved-measurement-store")]),
  })
  .strict();

const workflowRunIdSchema = z.string().uuid();

export const workflowRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    workflowId: z.literal("public-smoke"),
    inputClassification: z.literal("public"),
    message: z.string().trim().min(1).max(4_096),
  })
  .strict();

export const workflowResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    workflowId: z.literal("public-smoke"),
    outputClassification: z.literal("public"),
    runId: workflowRunIdSchema,
    manifestValid: z.literal(true),
    executedSkillIds: z.tuple([
      z.literal("public-echo"),
      z.literal("classification-check"),
    ]),
  })
  .strict();

export const worksheetImageReadRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    workbookBytes: nonEmptyWorkbookBytesSchema,
    workbookContentHash: sha256Schema,
    imageContentHash: sha256Schema,
  })
  .strict();

export const worksheetImageReadResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    classification: z.literal("confidential"),
    workbookContentHash: sha256Schema,
    imageContentHash: sha256Schema,
    mediaType: worksheetImageMediaTypeSchema,
    bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.length > 0, {
      message: "bytes must not be empty",
    }),
  })
  .strict();

export const knowledgeBaseManifestResponseSchema = knowledgeBaseManifestSchema;

export const knowledgeBaseQueryResultSchema = z.union([
  capabilityMatchResultSchema,
  capabilityUnknownResultSchema,
  engineeringRuleMatchResultSchema,
  engineeringRuleUnknownResultSchema,
  terminologyMatchResultSchema,
  terminologyUnknownResultSchema,
]);

export const internalToleranceGuidanceVersionSchema = z.literal("internal-v1");

export const internalToleranceGuidanceSourceMetadataSchema = z
  .object({
    sourceId: z.string().min(1),
    sourceFile: z.string().min(1),
    sourceFileHash: sha256Schema,
    sourceVersion: z.string().min(1),
    sheetName: z.string().min(1),
    sourceRange: z.string().regex(/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/),
    classification: z.literal("internal"),
  })
  .strict();

export const internalToleranceGuidanceManifestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    knowledgeBaseVersion: internalToleranceGuidanceVersionSchema,
    classification: z.literal("internal"),
    releasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    changeSummary: z.string().min(1),
    sourceCount: z.number().int().nonnegative(),
    entryCount: z.number().int().nonnegative(),
    sourcesContentHash: sha256Schema,
    entriesContentHash: sha256Schema,
  })
  .strict();

export const internalToleranceProcessFamilySchema = z.enum([
  "cnc-machining",
  "die-casting",
  "die-cutting",
  "pcb-fpc",
  "plastic-injection-molding",
  "sheet-metal",
]);

export const toleranceRepresentationSchema = z.enum([
  "bilateral",
  "unilateral",
  "total-band",
]);

const internalToleranceBandSchema = z
  .object({
    value: z.number().finite().positive(),
    unit: z.literal("mm"),
  })
  .strict();

const internalNominalRangeSchema = z
  .object({
    min: z.number().finite(),
    minInclusive: z.boolean().optional(),
    max: z.number().finite(),
    maxInclusive: z.boolean().optional(),
    unit: z.literal("mm"),
  })
  .strict()
  .refine((range) => range.min < range.max
    || range.min === range.max && range.minInclusive !== false && range.maxInclusive !== false, {
    message: "nominal range must contain at least one value",
    path: ["min"],
  });

export const internalEvidenceSchema = z
  .object({
    sourceFile: z.string().min(1),
    sourceFileHash: sha256Schema,
    sheetName: z.string().min(1),
    sourceRange: z.string().regex(/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/),
  })
  .strict();

export const internalToleranceGuidanceProvenanceSchema = internalToleranceGuidanceSourceMetadataSchema
  .extend({
    owner: z.string().min(1),
    confidence: z.number().finite().min(0).max(1),
    effectiveVersion: internalToleranceGuidanceVersionSchema,
    changeSummary: z.string().min(1),
  })
  .strict();

const internalToleranceConditionStringSchema = z.string().trim().min(1);

export const internalToleranceGuidanceEntryConditionsSchema = z
  .object({
    processMethod: internalToleranceConditionStringSchema.optional(),
    materialFamily: internalToleranceConditionStringSchema.optional(),
    thicknessMm: z
      .object({
        min: z.number().finite(),
        minInclusive: z.boolean().optional(),
        max: z.number().finite(),
        maxInclusive: z.boolean().optional(),
      })
      .strict()
      .refine((range) => range.min < range.max
        || range.min === range.max && range.minInclusive !== false && range.maxInclusive !== false, {
        message: "thickness range must contain at least one value",
        path: ["min"],
      })
      .optional(),
    toleranceGrade: internalToleranceConditionStringSchema.optional(),
    dimensionType: z.enum(["W", "NW"]).optional(),
  })
  .strict();

export const internalToleranceGuidanceRequestConditionsSchema = z
  .object({
    processMethod: internalToleranceConditionStringSchema.optional(),
    materialFamily: internalToleranceConditionStringSchema.optional(),
    thicknessMm: z.number().finite().optional(),
    toleranceGrade: internalToleranceConditionStringSchema.optional(),
    dimensionType: z.enum(["W", "NW"]).optional(),
  })
  .strict();

export const internalToleranceGuidanceEntrySchema = z
  .object({
    entryId: z.string().min(1),
    processFamily: internalToleranceProcessFamilySchema,
    featureType: z.string().min(1),
    material: z.string().min(1).optional(),
    nominalRange: internalNominalRangeSchema.optional(),
    maximumRecommendedTotalBand: internalToleranceBandSchema,
    fallbackPriority: z.number().int().nonnegative(),
    fallbackEntryId: z.string().min(1).optional(),
    conditions: internalToleranceGuidanceEntryConditionsSchema.optional(),
    capabilityTier: z.enum(["T1", "T2", "T3"]),
    provenance: internalToleranceGuidanceProvenanceSchema,
  })
  .strict();

const bilateralOrTotalBandToleranceSchema = z
  .object({
    representation: z.enum(["bilateral", "total-band"]),
    value: z.number().finite().positive(),
    unit: z.literal("mm"),
  })
  .strict();

const unilateralToleranceSchema = z
  .object({
    representation: z.literal("unilateral"),
    value: z.number().finite().positive(),
    unit: z.literal("mm"),
    upperValue: z.number().finite(),
    lowerValue: z.number().finite(),
  })
  .strict()
  .refine((tolerance) => tolerance.upperValue > tolerance.lowerValue, {
    message: "upperValue must be greater than lowerValue",
    path: ["upperValue"],
  })
  .refine((tolerance) => tolerance.value === tolerance.upperValue - tolerance.lowerValue, {
    message: "value must equal upperValue minus lowerValue",
    path: ["value"],
  });

export const internalToleranceGuidanceRequestSchema = z
  .object({
    processFamily: internalToleranceProcessFamilySchema,
    featureType: z.string().min(1),
    nominalValue: z.number().finite(),
    nominalUnit: z.literal("mm"),
    material: z.string().min(1).optional(),
    conditions: internalToleranceGuidanceRequestConditionsSchema.optional(),
    tolerance: z.union([bilateralOrTotalBandToleranceSchema, unilateralToleranceSchema]),
  })
  .strict();

const internalToleranceGuidanceMatchResultSchema = z
  .object({
    status: z.enum(["within-guidance", "guidance-exceeded"]),
    knowledgeBaseVersion: internalToleranceGuidanceVersionSchema,
    matchedEntryId: z.string().min(1),
    assessedTotalBand: internalToleranceBandSchema,
    maximumRecommendedTotalBand: internalToleranceBandSchema,
    fallbackApplied: z.boolean(),
    evidence: internalEvidenceSchema,
  })
  .strict();

const internalToleranceGuidanceUnknownResultSchema = z
  .object({
    status: z.literal("unknown"),
    knowledgeBaseVersion: internalToleranceGuidanceVersionSchema,
    capabilityTier: z.literal("T0"),
    message: z.literal("制程能力未知，请与供应商确认"),
  })
  .strict();

export const internalToleranceGuidanceResultSchema = z.union([
  internalToleranceGuidanceMatchResultSchema,
  internalToleranceGuidanceUnknownResultSchema,
]);

export const interpretationRuleVersionSchema = z.literal("interpretation-rules-v1");

export const interpretationEntryTypeSchema = z.enum([
  "metric-definition",
  "performance-rule",
  "root-cause-signal",
  "improvement-option",
  "decision-policy",
]);

const interpretationSourceRangeSchema = z.string().regex(/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/);

export const interpretationProvenanceSchema = z
  .object({
    classification: z.literal("internal"),
    sourceAlias: z.string().min(1),
    sourceFileHash: sha256Schema,
    sourceVersion: z.string().min(1),
    sheetName: z.string().min(1),
    sourceRange: interpretationSourceRangeSchema,
    owner: z.string().min(1),
    confidence: z.number().finite().min(0).max(1),
    effectiveVersion: interpretationRuleVersionSchema,
    changeSummary: z.string().min(1),
  })
  .strict();

const interpretationApplicabilitySchema = z
  .object({
    analysisDimension: z.literal("one-dimensional"),
    method: z.enum(["rss", "worst-case"]).optional(),
  })
  .strict();

const interpretationEntryFields = {
  entryId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  applicability: interpretationApplicabilitySchema,
  relatedEntryIds: z.array(z.string().min(1)),
  provenance: interpretationProvenanceSchema,
};

const interpretationMetricDefinitionSchema = z
  .object({
    ...interpretationEntryFields,
    entryType: z.literal("metric-definition"),
    metric: z.string().min(1),
    unit: z.string().min(1),
  })
  .strict();

const interpretationPerformanceRuleSchema = z
  .object({
    ...interpretationEntryFields,
    entryType: z.literal("performance-rule"),
    metric: z.string().min(1),
    comparison: z.enum([
      "greater-than-or-equal",
      "greater-than",
      "less-than-or-equal",
      "less-than",
      "equal",
      "not-equal",
    ]),
    targetSource: z.literal("resolved-target"),
    requiredFacts: z.array(z.string().min(1)),
    outcomeWhenMatched: z.enum(["meets-target", "below-target"]),
  })
  .strict();

const interpretationRootCauseSignalSchema = z
  .object({
    ...interpretationEntryFields,
    entryType: z.literal("root-cause-signal"),
    signalStatus: z.literal("hypothesis"),
    requiredFacts: z.array(z.string().min(1)),
    validationFacts: z.array(z.string().min(1)),
    activationCondition: z
      .object({
        kind: z.literal("maximum-contribution-at-least"),
        thresholdPercent: z.number().finite().min(0).max(100),
      })
      .strict(),
  })
  .strict();

const interpretationImprovementOptionSchema = z
  .object({
    ...interpretationEntryFields,
    entryType: z.literal("improvement-option"),
    expectedImpact: z.string().min(1),
    tradeoffs: z.array(z.string().min(1)),
    validationSteps: z.array(z.string().min(1)),
  })
  .strict();

const interpretationDecisionPolicySchema = z
  .object({
    ...interpretationEntryFields,
    entryType: z.literal("decision-policy"),
    policyKind: z.enum([
      "applicability",
      "engineering-review",
      "evidence-sufficiency",
      "target-resolution",
    ]),
  })
  .strict();

export const interpretationKnowledgeEntrySchema = z.discriminatedUnion("entryType", [
  interpretationMetricDefinitionSchema,
  interpretationPerformanceRuleSchema,
  interpretationRootCauseSignalSchema,
  interpretationImprovementOptionSchema,
  interpretationDecisionPolicySchema,
]);

export const interpretationKnowledgeSourceMetadataSchema = z
  .object({
    sourceAlias: z.string().min(1),
    sourceFileHash: sha256Schema,
    sourceVersion: z.string().min(1),
    classification: z.literal("internal"),
    owner: z.string().min(1),
  })
  .strict();

const interpretationEntryTypeCountsSchema = z
  .object({
    "metric-definition": z.number().int().nonnegative(),
    "performance-rule": z.number().int().nonnegative(),
    "root-cause-signal": z.number().int().nonnegative(),
    "improvement-option": z.number().int().nonnegative(),
    "decision-policy": z.number().int().nonnegative(),
  })
  .strict();

export const interpretationKnowledgeManifestSchema = z
  .object({
    version: interpretationRuleVersionSchema,
    classification: z.literal("internal"),
    sourceCount: z.number().int().nonnegative(),
    entryCount: z.number().int().nonnegative(),
    entryTypeCounts: interpretationEntryTypeCountsSchema,
    sourcesHash: sha256Schema,
    entriesHash: sha256Schema,
    contentHash: sha256Schema,
  })
  .strict();

export const interpretationKnowledgeSeedPackageSchema = z
  .object({
    manifest: interpretationKnowledgeManifestSchema,
    sources: z.array(interpretationKnowledgeSourceMetadataSchema),
    entries: z.array(interpretationKnowledgeEntrySchema),
  })
  .strict()
  .superRefine((seedPackage, context) => {
    if (seedPackage.manifest.sourceCount !== seedPackage.sources.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sourceCount must equal sources length",
        path: ["manifest", "sourceCount"],
      });
    }

    if (seedPackage.manifest.entryCount !== seedPackage.entries.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "entryCount must equal entries length",
        path: ["manifest", "entryCount"],
      });
    }

    for (const entryType of interpretationEntryTypeSchema.options) {
      const actualCount = seedPackage.entries.filter((entry) => entry.entryType === entryType).length;
      if (seedPackage.manifest.entryTypeCounts[entryType] !== actualCount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${entryType} count must equal the number of matching entries`,
          path: ["manifest", "entryTypeCounts", entryType],
        });
      }
    }
  });

export const interpretationRuleLoadRequestSchema = z
  .object({
    version: interpretationRuleVersionSchema,
  })
  .strict();

const interpretationRequestTargetSchema = z
  .object({
    value: z.number().finite().positive(),
    source: z.enum(["project", "template"]),
  })
  .strict();

const interpretationResolvedTargetSchema = z
  .object({
    value: z.number().finite().positive(),
    source: z.enum(["project", "template", "controlled-default"]),
  })
  .strict();

const interpretationContributorFactSchema = z
  .object({
    reference: z.string().min(1),
    contributionPercent: z.number().finite().min(0).max(100),
  })
  .strict();

const interpretationFactsSchema = z
  .object({
    cpk: z.number().finite().optional(),
    targetCpk: interpretationRequestTargetSchema.optional(),
    achievedSigma: z.number().finite().optional(),
    targetSigma: interpretationRequestTargetSchema.optional(),
    contributors: z.array(interpretationContributorFactSchema).optional(),
  })
  .strict();

export const interpretationRuleEvaluationRequestSchema = z
  .object({
    analysisDimension: z.literal("one-dimensional"),
    method: z.enum(["rss", "worst-case"]),
    facts: interpretationFactsSchema,
  })
  .strict();

const interpretationResolvedTargetsSchema = z
  .object({
    cpk: interpretationResolvedTargetSchema.optional(),
    sigma: interpretationResolvedTargetSchema.optional(),
  })
  .strict();

const interpretationRuleEvidenceSchema = z
  .object({
    sourceAlias: z.string().min(1),
    sheetName: z.string().min(1),
    sourceRange: interpretationSourceRangeSchema,
    sourceFileHash: sha256Schema,
  })
  .strict();

const interpretationMatchedRuleSchema = z
  .object({
    entryId: z.string().min(1),
    entryType: z.enum(["performance-rule", "root-cause-signal", "improvement-option"]),
    relatedFactReferences: z.array(z.string().min(1)),
    evidence: interpretationRuleEvidenceSchema,
  })
  .strict();

export const interpretationRuleEvaluationSchema = z
  .object({
    knowledgeBaseVersion: interpretationRuleVersionSchema,
    status: z.enum(["matched", "insufficient-facts", "not-applicable"]),
    resolvedTargets: interpretationResolvedTargetsSchema.optional(),
    factsUsed: z.array(z.string().min(1)),
    matchedRules: z.array(interpretationMatchedRuleSchema),
    missingFacts: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((evaluation, context) => {
    if (evaluation.status === "matched") {
      if (evaluation.matchedRules.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "matched evaluations must include at least one matched rule",
          path: ["matchedRules"],
        });
      }
      if (evaluation.missingFacts.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "matched evaluations must not include missing facts",
          path: ["missingFacts"],
        });
      }
    }

    if (evaluation.status === "insufficient-facts") {
      if (evaluation.matchedRules.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "insufficient-facts evaluations must not include matched rules",
          path: ["matchedRules"],
        });
      }
      if (evaluation.missingFacts.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "insufficient-facts evaluations must include at least one missing fact",
          path: ["missingFacts"],
        });
      }
    }

    if (evaluation.status === "not-applicable") {
      if (evaluation.matchedRules.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "not-applicable evaluations must not include matched rules",
          path: ["matchedRules"],
        });
      }
      if (evaluation.missingFacts.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "not-applicable evaluations must not include missing facts",
          path: ["missingFacts"],
        });
      }
      if (evaluation.resolvedTargets === undefined || Object.keys(evaluation.resolvedTargets).length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "not-applicable evaluations must include an empty resolvedTargets object",
          path: ["resolvedTargets"],
        });
      }
    }
  });

export type DataClassification = z.infer<typeof dataClassificationSchema>;
export type RunRequest = z.infer<typeof runRequestSchema>;
export type CapabilityTier = z.infer<typeof capabilityTierSchema>;
export type Distribution = z.infer<typeof distributionSchema>;
export type KnowledgeLibraryId = z.infer<typeof knowledgeLibraryIdSchema>;
export type KnowledgeBaseVersion = z.infer<typeof knowledgeBaseVersionSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type CapabilityEntry = z.infer<typeof capabilityEntrySchema>;
export type EngineeringRuleEntry = z.infer<typeof engineeringRuleEntrySchema>;
export type TerminologyEntry = z.infer<typeof terminologyEntrySchema>;
export type KnowledgeBaseManifest = z.infer<typeof knowledgeBaseManifestSchema>;
export type KnowledgeBaseQueryRequest = z.infer<typeof knowledgeBaseQueryRequestSchema>;
export type EngineeringRuleQuery = z.infer<typeof engineeringRuleQuerySchema>;
export type TerminologyQuery = z.infer<typeof terminologyQuerySchema>;
export type CapabilityMatchResult = z.infer<typeof capabilityMatchResultSchema>;
export type CapabilityUnknownResult = z.infer<typeof capabilityUnknownResultSchema>;
export type EngineeringRuleMatchResult = z.infer<typeof engineeringRuleMatchResultSchema>;
export type EngineeringRuleUnknownResult = z.infer<typeof engineeringRuleUnknownResultSchema>;
export type TerminologyMatchResult = z.infer<typeof terminologyMatchResultSchema>;
export type TerminologyUnknownResult = z.infer<typeof terminologyUnknownResultSchema>;
export type KnowledgeBaseManifestResponse = z.infer<typeof knowledgeBaseManifestResponseSchema>;
export type KnowledgeBaseQueryResult = z.infer<typeof knowledgeBaseQueryResultSchema>;
export type InternalToleranceGuidanceVersion = z.infer<typeof internalToleranceGuidanceVersionSchema>;
export type InternalToleranceGuidanceSourceMetadata = z.infer<typeof internalToleranceGuidanceSourceMetadataSchema>;
export type InternalToleranceGuidanceManifest = z.infer<typeof internalToleranceGuidanceManifestSchema>;
export type InternalToleranceProcessFamily = z.infer<typeof internalToleranceProcessFamilySchema>;
export type ToleranceRepresentation = z.infer<typeof toleranceRepresentationSchema>;
export type InternalEvidence = z.infer<typeof internalEvidenceSchema>;
export type InternalToleranceGuidanceProvenance = z.infer<typeof internalToleranceGuidanceProvenanceSchema>;
export type InternalToleranceGuidanceEntryConditions = z.infer<typeof internalToleranceGuidanceEntryConditionsSchema>;
export type InternalToleranceGuidanceRequestConditions = z.infer<typeof internalToleranceGuidanceRequestConditionsSchema>;
export type InternalToleranceGuidanceEntry = z.infer<typeof internalToleranceGuidanceEntrySchema>;
export type InternalToleranceGuidanceRequest = z.infer<typeof internalToleranceGuidanceRequestSchema>;
export type InternalToleranceGuidanceResult = z.infer<typeof internalToleranceGuidanceResultSchema>;
export type InterpretationRuleVersion = z.infer<typeof interpretationRuleVersionSchema>;
export type InterpretationEntryType = z.infer<typeof interpretationEntryTypeSchema>;
export type InterpretationProvenance = z.infer<typeof interpretationProvenanceSchema>;
export type InterpretationKnowledgeEntry = z.infer<typeof interpretationKnowledgeEntrySchema>;
export type InterpretationKnowledgeSourceMetadata = z.infer<typeof interpretationKnowledgeSourceMetadataSchema>;
export type InterpretationKnowledgeManifest = z.infer<typeof interpretationKnowledgeManifestSchema>;
export type InterpretationKnowledgeSeedPackage = z.infer<typeof interpretationKnowledgeSeedPackageSchema>;
export type InterpretationRuleLoadRequest = z.infer<typeof interpretationRuleLoadRequestSchema>;
export type InterpretationRuleEvaluationRequest = z.infer<typeof interpretationRuleEvaluationRequestSchema>;
export type InterpretationRuleEvaluation = z.infer<typeof interpretationRuleEvaluationSchema>;
export type WorkbookCatalogRequest = z.infer<typeof workbookCatalogRequestSchema>;
export type WorkbookCatalogResult = z.infer<typeof workbookCatalogResultSchema>;
export type WorksheetSelectionViewRequest = z.infer<typeof worksheetSelectionViewRequestSchema>;
export type WorksheetSelectionViewResult = z.infer<typeof worksheetSelectionViewResultSchema>;
export type WorksheetAnalysisAssetsRequest = z.infer<typeof worksheetAnalysisAssetsRequestSchema>;
export type WorksheetAnalysisAssetsResult = z.infer<typeof worksheetAnalysisAssetsResultSchema>;
export type SemanticTableDetectionRequest = z.infer<typeof semanticTableDetectionRequestSchema>;
export type SemanticTableDetectionResult = z.infer<typeof semanticTableDetectionResultSchema>;
export type WorksheetImageReadRequest = z.infer<typeof worksheetImageReadRequestSchema>;
export type WorksheetImageReadResult = z.infer<typeof worksheetImageReadResultSchema>;
export type RequiredFieldCheckRequest = z.infer<typeof requiredFieldCheckRequestSchema>;
export type RequiredFieldCheckResult = z.infer<typeof requiredFieldCheckResultSchema>;
export type IdentifierQualityCheckRequest = z.infer<typeof identifierQualityCheckRequestSchema>;
export type IdentifierQualityCheckResult = z.infer<typeof identifierQualityCheckResultSchema>;
export type CapabilityValidationRequest = z.infer<typeof capabilityValidationRequestSchema>;
export type CapabilityValidationResult = z.infer<typeof capabilityValidationResultSchema>;
export type ExceptionResolutionRequest = z.infer<typeof exceptionResolutionRequestSchema>;
export type ExceptionResolutionResult = z.infer<typeof exceptionResolutionResultSchema>;
export type UnifiedExceptionResolutionV2Request = z.infer<typeof unifiedExceptionResolutionV2RequestSchema>;
export type UnifiedExceptionResolutionV2Result = z.infer<typeof unifiedExceptionResolutionV2ResultSchema>;
export type UnifiedExceptionResolutionRequest = UnifiedExceptionResolutionV2Request;
export type UnifiedExceptionResolutionResult = UnifiedExceptionResolutionV2Result;
export type CalculationUnavailableRequest = z.infer<typeof calculationUnavailableRequestSchema>;
export type CalculationRequest = z.infer<typeof calculationRequestSchema>;
export type CalculationResult = z.infer<typeof calculationResultSchema>;
export type CalculationMethod = z.infer<typeof calculationMethodSchema>;
export type CalculationCriticality = z.infer<typeof calculationCriticalitySchema>;
export type CalculationScenarioOverride = z.infer<typeof calculationScenarioOverrideSchema>;
export type CalculationRecommendation = z.infer<typeof calculationRecommendationSchema>;
export type CalculationFactorSource = z.infer<typeof calculationFactorSourceSchema>;
export type CalculationFactorInput = z.infer<typeof calculationFactorInputSchema>;
export type CalculationFactorResult = z.infer<typeof calculationFactorResultSchema>;
export type CalculationSystemResult = z.infer<typeof calculationSystemResultSchema>;
export type CalculationCapabilityResult = z.infer<typeof calculationCapabilityResultSchema>;
export type CalculationTraceRecord = z.infer<typeof calculationTraceRecordSchema>;
export type CalculationCompletedPayload = z.infer<typeof calculationPayloadSchema>;
export type CalculationCompletedResult = z.infer<typeof calculationCompletedResultSchema>;
export type CalculationLegacyUnavailableResult = z.infer<typeof calculationLegacyUnavailableResultSchema>;
export type DrawingGovernanceRequest = z.infer<typeof drawingGovernanceRequestSchema>;
export type DrawingGovernanceResult = z.infer<typeof drawingGovernanceResultSchema>;
export type InterpretationRequest = z.infer<typeof interpretationRequestSchema>;
export type InterpretationResult = z.infer<typeof interpretationResultSchema>;
export type ComparisonRequest = z.infer<typeof comparisonRequestSchema>;
export type ComparisonResult = z.infer<typeof comparisonResultSchema>;
export type CpkRequest = z.infer<typeof cpkRequestSchema>;
export type CpkResult = z.infer<typeof cpkResultSchema>;
export type PublicWorkflowRequest = z.infer<typeof workflowRequestSchema>;
export type PublicWorkflowResult = z.infer<typeof workflowResultSchema>;
