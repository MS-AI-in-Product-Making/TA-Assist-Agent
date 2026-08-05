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
  "capability-item-mapping",
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

export const capabilityItemMappingSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  partCategory: z.string().min(1),
  capabilityEntryId: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1).refine(
    (keywords) => new Set(keywords.map((keyword) => keyword.trim().toLowerCase())).size === keywords.length,
    { message: "keywords must be unique" },
  ),
  provenance: provenanceSchema,
}).strict();

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
  z.object({
    libraryId: z.literal("capability-item-mapping"),
    contractId: z.literal("capability-item-mapping-v1"),
    entryCount: z.number().int().min(0),
    coverage: z.array(z.string().min(1)).min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
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
      .length(4)
      .refine(
        (libraries) => new Set(libraries.map((library) => library.libraryId)).size === 4,
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

export const capabilityItemQuerySchema = z.object({
  partCategory: z.string().min(1),
  factorName: z.string(),
  partName: z.string(),
}).strict();

const capabilityItemCandidateSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  capabilityEntryId: z.string().min(1),
  hitKeywords: z.array(z.string().min(1)).min(1),
  hitSources: z.array(z.enum(["factorName", "partName"])).min(1),
}).strict();

export const capabilityItemMatchResultSchema = z.discriminatedUnion("status", [
  z.object({ queryType: z.literal("capability-item"), status: z.literal("category_not_defined"), contractVersion: contractVersionSchema, knowledgeBaseVersion: knowledgeBaseVersionSchema }).strict(),
  z.object({ queryType: z.literal("capability-item"), status: z.literal("item_unmatched"), contractVersion: contractVersionSchema, knowledgeBaseVersion: knowledgeBaseVersionSchema, canonicalPartCategory: z.string().min(1) }).strict(),
  z.object({ queryType: z.literal("capability-item"), status: z.literal("item_ambiguous"), contractVersion: contractVersionSchema, knowledgeBaseVersion: knowledgeBaseVersionSchema, canonicalPartCategory: z.string().min(1), candidates: z.array(capabilityItemCandidateSchema).min(2) }).strict(),
  z.object({ queryType: z.literal("capability-item"), status: z.literal("matched"), contractVersion: contractVersionSchema, knowledgeBaseVersion: knowledgeBaseVersionSchema, canonicalPartCategory: z.string().min(1), candidate: capabilityItemCandidateSchema, capabilityEntry: capabilityEntrySchema }).strict(),
]);

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

export const workbookCatalogAnalysisSourceSchema = z.union([
  z
    .object({
      summarySheet: z.literal("Auto Summary"),
      summaryRow: z.number().int().positive(),
      worksheetAnchor: z.string().regex(/^[^!]+!A1$/),
    })
    .strict(),
  z
    .object({
      discoveryMethod: z.literal("worksheet_scan"),
      descriptionCell: z.string().regex(/^[^!]+![A-Z]+[1-9]\d*$/),
      worksheetAnchor: z.string().regex(/^[^!]+!A1$/),
    })
    .strict(),
]);

export const workbookCatalogAnalysisSchema = z
  .object({
    worksheetName: z.string().min(1),
    toleranceLoopDescription: z.string().min(1),
    source: workbookCatalogAnalysisSourceSchema,
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
            source: workbookCatalogAnalysisSourceSchema,
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
  "partNumber",
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

const tolerancePathImageSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    labelSourceCell: worksheetSourceCellSchema,
    imageContentHash: sha256Schema,
    imageAnchor: z.object({
      from: z.string().regex(/^[A-Z]+[1-9]\d*$/),
      to: z.string().regex(/^[A-Z]+[1-9]\d*$/),
    }).strict(),
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    reasonCode: z.enum([
      "label_missing",
      "label_ambiguous",
      "image_missing",
      "unsupported_media_type",
      "unparsed_anchor",
      "worksheet_unavailable",
    ]),
    labelSourceCell: worksheetSourceCellSchema.optional(),
  }).strict(),
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
          tolerancePathImage: tolerancePathImageSchema.optional(),
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

export const calculationRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    projectReference: controlledCalculationReferenceSchema,
    runReference: controlledCalculationReferenceSchema,
    worksheetReferences: z.array(controlledCalculationReferenceSchema),
  })
  .strict();

export const calculationResultSchema = z
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
  capabilityItemMatchResultSchema,
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

export const f2InitialWorkflowRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  knowledgeBaseVersion: knowledgeBaseVersionSchema,
  mappingRuleVersion: z.literal("v1"),
  toleranceUnitAssumption: z.literal("mm"),
  worksheetAnalysisAssets: worksheetAnalysisAssetsResultSchema,
}).strict().superRefine((request, context) => {
  const worksheetNames = request.worksheetAnalysisAssets.worksheets.map((worksheet) => worksheet.worksheetName);
  if (new Set(worksheetNames).size !== worksheetNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique", path: ["worksheetAnalysisAssets", "worksheets"] });
  }
});

const f2SourceReferenceSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1).optional(),
  sourceRow: z.number().int().positive().optional(),
  sourceCell: worksheetSourceCellSchema.optional(),
}).strict();

const f2RowSourceReferenceSchema = f2SourceReferenceSchema.extend({
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
}).strict();

const f2CapabilityEvidenceSchema = f2RowSourceReferenceSchema.extend({
  knowledgeBaseVersion: knowledgeBaseVersionSchema,
  mappingRuleVersion: z.literal("v1"),
  itemId: z.string().min(1),
  capabilityEntryId: z.string().min(1),
  totalTolerance: z.number().finite().nonnegative(),
  unit: z.literal("mm"),
  actualDistribution: distributionSchema,
  recommendedDistribution: distributionSchema,
  hitKeywords: z.array(z.string().min(1)).min(1),
  sourceCells: z.object({
    upperTolerance: worksheetSourceCellSchema,
    lowerTolerance: worksheetSourceCellSchema,
    distribution: worksheetSourceCellSchema,
  }).strict(),
}).strict();

const f2BlockingIssueSchema = z.discriminatedUnion("issueCode", [
  f2RowSourceReferenceSchema.extend({
    issueCode: z.literal("required_field_unavailable"),
    field: requiredFieldNameSchema,
    reasonCode: worksheetUnavailableReasonCodeSchema,
  }).strict(),
  f2SourceReferenceSchema.extend({ issueCode: z.literal("factor_table_has_no_rows") }).strict(),
  f2SourceReferenceSchema.extend({
    issueCode: z.literal("cross_section_image_unavailable"),
    reasonCode: z.enum(["evidence_not_produced", "label_missing", "label_ambiguous", "image_missing", "unsupported_media_type", "unparsed_anchor"]),
  }).strict(),
  f2CapabilityEvidenceSchema.extend({ issueCode: z.literal("tolerance_out_of_range") }).strict(),
  f2CapabilityEvidenceSchema.extend({ issueCode: z.literal("distribution_mismatch") }).strict(),
]);

const f2MappingRecordBaseSchema = f2RowSourceReferenceSchema.extend({
  knowledgeBaseVersion: knowledgeBaseVersionSchema,
  mappingRuleVersion: z.literal("v1"),
  partCategory: z.string().min(1),
  factorName: z.string(),
  partName: z.string(),
  sourceCells: z.object({
    partCategory: worksheetSourceCellSchema,
    factorName: worksheetSourceCellSchema,
    partName: worksheetSourceCellSchema,
  }).strict(),
});

const f2MappingCandidateSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  capabilityEntryId: z.string().min(1),
  hitKeywords: z.array(z.string().min(1)).min(1),
  hitSources: z.array(z.enum(["factorName", "partName"])).min(1),
}).strict();

const f2MappingRecordSchema = z.discriminatedUnion("status", [
  f2MappingRecordBaseSchema.extend({ status: z.literal("category_not_defined") }).strict(),
  f2MappingRecordBaseSchema.extend({ status: z.literal("item_unmatched"), canonicalPartCategory: z.string().min(1) }).strict(),
  f2MappingRecordBaseSchema.extend({
    status: z.literal("item_ambiguous"),
    canonicalPartCategory: z.string().min(1),
    candidates: z.array(f2MappingCandidateSchema).min(2),
  }).strict(),
]);

const f2CapabilityCheckSchema = z.discriminatedUnion("status", [
  f2CapabilityEvidenceSchema.extend({ status: z.literal("tolerance_and_distribution_match") }).strict(),
  f2CapabilityEvidenceSchema.extend({ status: z.literal("tolerance_out_of_range") }).strict(),
  f2CapabilityEvidenceSchema.extend({ status: z.literal("distribution_mismatch") }).strict(),
  f2CapabilityEvidenceSchema.extend({ status: z.literal("tolerance_and_distribution_mismatch") }).strict(),
]);

const f2GovernanceSignalBaseSchema = f2RowSourceReferenceSchema.extend({
  field: optionalIdentifierFieldNameSchema,
});

const f2GovernanceSignalSchema = z.discriminatedUnion("signalKind", [
  f2GovernanceSignalBaseSchema.extend({ signalKind: z.literal("identifier_missing") }).strict(),
  f2GovernanceSignalBaseSchema.extend({ signalKind: z.literal("identifier_evidence_unavailable"), reasonCode: worksheetUnavailableReasonCodeSchema }).strict(),
  f2GovernanceSignalBaseSchema.extend({ signalKind: z.literal("identifier_text_invalid") }).strict(),
  f2GovernanceSignalBaseSchema.extend({ signalKind: z.literal("dim_id_duplicate"), field: z.literal("dimCharacteristicId"), normalizedDimId: z.string().min(1) }).strict(),
]);

const f2InitialWorksheetResultSchema = z.object({
  worksheetName: z.string().min(1),
  status: z.enum(["blocked", "readyForNextFeature"]),
  blockingIssues: z.array(f2BlockingIssueSchema),
  mappingRecords: z.array(f2MappingRecordSchema),
  capabilityChecks: z.array(f2CapabilityCheckSchema),
  governanceSignals: z.array(f2GovernanceSignalSchema),
}).strict().superRefine((worksheet, context) => {
  if ((worksheet.status === "blocked") !== (worksheet.blockingIssues.length > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet status must match blocking issues", path: ["status"] });
  }
  for (const collectionName of ["blockingIssues", "mappingRecords", "capabilityChecks", "governanceSignals"] as const) {
    worksheet[collectionName].forEach((record, index) => {
      if (record.worksheetName !== worksheet.worksheetName) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "record worksheetName must match its worksheet", path: [collectionName, index, "worksheetName"] });
      }
    });
  }
});

const f2InitialSummarySchema = z.object({
  worksheetsChecked: z.number().int().positive(),
  readyForNextFeatureCount: z.number().int().nonnegative(),
  blockedWorksheetCount: z.number().int().nonnegative(),
  blockingIssueCount: z.number().int().nonnegative(),
  mappingRecordCount: z.number().int().nonnegative(),
  capabilityCheckCount: z.number().int().nonnegative(),
  governanceSignalCount: z.number().int().nonnegative(),
}).strict();

export const f2InitialWorkflowResultSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  knowledgeBaseVersion: knowledgeBaseVersionSchema,
  mappingRuleVersion: z.literal("v1"),
  workbookContentHash: sha256Schema,
  toleranceUnitAssumption: z.literal("mm"),
  status: z.enum(["completed", "partiallyBlocked", "blocked"]),
  worksheets: z.array(f2InitialWorksheetResultSchema).min(1),
  summary: f2InitialSummarySchema,
}).strict().superRefine((result, context) => {
  const worksheetNames = result.worksheets.map((worksheet) => worksheet.worksheetName);
  if (new Set(worksheetNames).size !== worksheetNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique", path: ["worksheets"] });
  }
  const blockedWorksheetCount = result.worksheets.filter((worksheet) => worksheet.status === "blocked").length;
  const readyForNextFeatureCount = result.worksheets.length - blockedWorksheetCount;
  const expectedStatus = blockedWorksheetCount === 0 ? "completed" : readyForNextFeatureCount === 0 ? "blocked" : "partiallyBlocked";
  if (result.status !== expectedStatus) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "workflow status must match worksheet statuses", path: ["status"] });
  }
  const expectedSummary = {
    worksheetsChecked: result.worksheets.length,
    readyForNextFeatureCount,
    blockedWorksheetCount,
    blockingIssueCount: result.worksheets.reduce((count, worksheet) => count + worksheet.blockingIssues.length, 0),
    mappingRecordCount: result.worksheets.reduce((count, worksheet) => count + worksheet.mappingRecords.length, 0),
    capabilityCheckCount: result.worksheets.reduce((count, worksheet) => count + worksheet.capabilityChecks.length, 0),
    governanceSignalCount: result.worksheets.reduce((count, worksheet) => count + worksheet.governanceSignals.length, 0),
  };
  for (const [field, expected] of Object.entries(expectedSummary)) {
    if (result.summary[field as keyof typeof expectedSummary] !== expected) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must match worksheet records`, path: ["summary", field] });
    }
  }
  result.worksheets.forEach((worksheet, worksheetIndex) => {
    for (const collectionName of ["mappingRecords", "capabilityChecks"] as const) {
      worksheet[collectionName].forEach((record, recordIndex) => {
        if (record.knowledgeBaseVersion !== result.knowledgeBaseVersion || record.mappingRuleVersion !== result.mappingRuleVersion) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "record versions must match workflow versions", path: ["worksheets", worksheetIndex, collectionName, recordIndex] });
        }
      });
    }
  });
});

const relativeArtifactPathSchema = z.string().min(1).refine((value) => {
  const normalized = value.replace(/\\/g, "/");
  return !/^(?:[A-Za-z]:|\/)/.test(normalized) && !normalized.split("/").includes("..");
}, "artifact path must stay relative to its root");

const f1ArtifactFieldSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    sourceCell: worksheetSourceCellSchema,
    displayValue: z.string(),
    actualValue: z.union([z.string(), z.number().finite()]),
    valueOrigin: z.enum(["text_literal", "numeric_literal", "formula_cached"]),
    formula: z.string().optional(),
    cachedValue: z.string().optional(),
    numericValue: z.number().finite().optional(),
    unit: z.string().min(1).optional(),
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    reasonCode: worksheetUnavailableReasonCodeSchema,
    sourceCell: worksheetSourceCellSchema.optional(),
    displayValue: z.literal(""),
    actualValue: z.literal(""),
    valueOrigin: z.literal("missing"),
  }).strict(),
]);

const f2ActualScalarSchema = z.union([z.string(), z.number().finite(), z.null()]);

const f2ActualFieldsSchema = z.object({
  factorName: z.string().nullable(),
  partName: z.string().nullable(),
  drawingNumber: f2ActualScalarSchema,
  dimCharacteristicId: f2ActualScalarSchema,
  partCategory: z.string().nullable(),
  nominalValue: f2ActualScalarSchema,
  upperTolerance: f2ActualScalarSchema,
  lowerTolerance: f2ActualScalarSchema,
  longTermSafetyFactor: f2ActualScalarSchema,
  sigmaLevel: f2ActualScalarSchema,
  distribution: z.string().nullable(),
  mean: f2ActualScalarSchema,
  tolerance: f2ActualScalarSchema,
  oneSigma: f2ActualScalarSchema,
  percentContributionToSigma: f2ActualScalarSchema,
  notes: f2ActualScalarSchema,
}).strict();

const f1ArtifactFactorTableSchema = z.object({
  tableId: z.string().min(1),
  headerRow: z.number().int().positive(),
  dataRange: z.object({ startRow: z.number().int().positive(), endRow: z.number().int().positive() }).strict(),
  columns: z.array(z.object({ semanticField: worksheetFieldNameSchema, headerText: z.string(), sourceColumn: z.string().regex(/^[A-Z]+$/) }).strict()),
  rows: z.array(z.object({
    sourceRow: z.number().int().positive(),
    fields: z.record(worksheetFieldNameSchema, f1ArtifactFieldSchema),
    actualFields: f2ActualFieldsSchema,
  }).strict()),
}).strict();

const f2ArtifactTolerancePathImageSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), imagePath: relativeArtifactPathSchema, contentHash: sha256Schema }).strict(),
  z.object({
    status: z.literal("unavailable"),
    reasonCode: z.enum(["label_missing", "label_ambiguous", "image_missing", "image_empty", "image_unsupported", "unparsed_anchor", "worksheet_unavailable"]),
  }).strict(),
]);

export const f2ArtifactInputSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  artifactRoot: z.string().min(1),
  workbook: z.object({ fileName: z.string().min(1), contentHash: sha256Schema, f1GeneratedAt: z.string().datetime() }).strict(),
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    worksheetJsonPath: relativeArtifactPathSchema,
    worksheetMdPath: relativeArtifactPathSchema,
    tolerancePathImage: f2ArtifactTolerancePathImageSchema,
    factorTables: z.array(f1ArtifactFactorTableSchema),
  }).strict()).min(1),
}).strict().superRefine((input, context) => {
  const names = input.worksheets.map((worksheet) => worksheet.worksheetName);
  if (new Set(names).size !== names.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique", path: ["worksheets"] });
});

const f2CapabilityStatusSchema = z.enum([
  "in_library_recommended",
  "in_library_tolerance_outside",
  "in_library_distribution_differs",
  "in_library_tolerance_and_distribution_differ",
  "outside_library",
  "internal_within_guidance",
  "internal_guidance_exceeded",
  "f0_information_insufficient",
  "non_f0_process_category",
  "unable_to_check",
]);

const f2PublicRecommendationSchema = z.object({
  kind: z.literal("public"),
  toleranceMin: z.number().finite(),
  toleranceMax: z.number().finite(),
  unit: z.literal("mm"),
  distribution: distributionSchema,
  capabilityEntryId: z.string().min(1),
}).strict();

const f2InternalRecommendationSchema = z.object({
  kind: z.literal("internal-guidance"),
  assessedTotalBand: z.number().finite().positive(),
  maximumRecommendedTotalBand: z.number().finite().positive(),
  unit: z.literal("mm"),
  matchedEntryId: z.string().min(1),
  fallbackApplied: z.boolean(),
  evidence: z.object({
    sourceFileHash: sha256Schema,
    sheetName: z.string().min(1),
    sourceRange: z.string().regex(/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/),
  }).strict(),
}).strict();

const f2EnhancedRowSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  actualFields: f2ActualFieldsSchema,
  sourceCells: z.record(worksheetFieldNameSchema, worksheetSourceCellSchema),
  imageTarget: z.object({
    relativePath: relativeArtifactPathSchema,
    contentHash: sha256Schema,
  }).strict().optional(),
  missingRequiredFields: z.array(requiredFieldNameSchema),
  missingIdentifiers: z.array(z.enum(["dimCharacteristicId", "partNumber"])),
  capabilityStatus: f2CapabilityStatusSchema,
  f0KnowledgeBaseVersion: z.enum(["v1", "internal-v1"]).optional(),
  recommendation: z.discriminatedUnion("kind", [f2PublicRecommendationSchema, f2InternalRecommendationSchema]).optional(),
  mappingReason: z.enum(["category_not_defined", "item_unmatched", "item_ambiguous"]).optional(),
  f0InformationReason: z.enum(["missing_process_context", "invalid_total_band", "guidance_unknown"]).optional(),
  adoReminderRequested: z.boolean(),
}).strict().superRefine((row, context) => {
  const publicMatch = row.capabilityStatus.startsWith("in_library_");
  const internalMatch = row.capabilityStatus === "internal_within_guidance" || row.capabilityStatus === "internal_guidance_exceeded";
  if (publicMatch && (row.f0KnowledgeBaseVersion !== "v1" || row.recommendation?.kind !== "public")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "public F0 rows require a v1 public recommendation", path: ["recommendation"] });
  }
  if (internalMatch && (row.f0KnowledgeBaseVersion !== "internal-v1" || row.recommendation?.kind !== "internal-guidance")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "internal F0 rows require an internal-v1 recommendation", path: ["recommendation"] });
  }
  if (!publicMatch && !internalMatch && row.recommendation !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "unmatched F0 rows must not include a recommendation", path: ["recommendation"] });
  }
  if (row.capabilityStatus === "f0_information_insufficient") {
    if (row.f0KnowledgeBaseVersion !== "internal-v1" || row.f0InformationReason === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "insufficient F0 rows require an internal-v1 reason", path: ["f0InformationReason"] });
    }
  } else if (row.f0InformationReason !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "only insufficient F0 rows may include an information reason", path: ["f0InformationReason"] });
  }
  if ((row.capabilityStatus === "non_f0_process_category" || row.capabilityStatus === "unable_to_check") && row.f0KnowledgeBaseVersion !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "rows without an F0 decision must not claim an F0 version", path: ["f0KnowledgeBaseVersion"] });
  }
});

const f2MissingFieldSummarySchema = z.object({
  field: z.union([requiredFieldNameSchema, z.literal("tolerancePathImage")]),
  factorCount: z.number().int().nonnegative(),
  sourceRows: z.array(z.number().int().positive()),
}).strict();

const f2AdoEventSchema = z.object({
  eventType: z.literal("adoReminderRequested"),
  category: z.string().min(1),
  worksheetName: z.string().min(1),
  missingFields: z.array(z.enum(["dimCharacteristicId", "partNumber"])).min(1),
  factorRows: z.array(z.number().int().positive()).min(1),
  workbookContentHash: sha256Schema,
}).strict();

const f2AcceptedReportSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  status: z.enum(["blocked", "partiallyBlocked", "completed"]),
  workbook: z.object({ fileName: z.string().min(1), contentHash: sha256Schema, f1GeneratedAt: z.string().datetime() }).strict(),
  knowledgeBaseVersions: z.tuple([knowledgeBaseVersionSchema, internalToleranceGuidanceVersionSchema]),
  mappingRuleVersion: z.literal("v1"),
  artifactRoot: z.string().min(1),
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    status: z.enum(["blocked", "ready"]),
    tolerancePathImageStatus: z.enum(["available", "unavailable"]),
    rows: z.array(f2EnhancedRowSchema),
    missingFieldSummary: z.array(f2MissingFieldSummarySchema),
  }).strict()).min(1),
  adoEvents: z.array(f2AdoEventSchema),
  summary: z.object({
    worksheetsChecked: z.number().int().positive(),
    blockedWorksheetCount: z.number().int().nonnegative(),
    readyWorksheetCount: z.number().int().nonnegative(),
    factorRowCount: z.number().int().nonnegative(),
    rowsWithRequiredMissing: z.number().int().nonnegative(),
    requiredMissingFieldCount: z.number().int().nonnegative(),
    missingImageWorksheetCount: z.number().int().nonnegative(),
    internalWithinGuidanceCount: z.number().int().nonnegative(),
    internalGuidanceExceededCount: z.number().int().nonnegative(),
    f0InformationInsufficientCount: z.number().int().nonnegative(),
    publicLibraryMatchCount: z.number().int().nonnegative(),
    nonF0ProcessCategoryCount: z.number().int().nonnegative(),
    unableToCheckCount: z.number().int().nonnegative(),
    publicToleranceDifferenceCount: z.number().int().nonnegative(),
    publicDistributionDifferenceCount: z.number().int().nonnegative(),
    missingDimIdCount: z.number().int().nonnegative(),
    missingPartNumberCount: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((report, context) => {
  const rows = report.worksheets.flatMap((worksheet) => worksheet.rows);
  const blockedWorksheetCount = report.worksheets.filter((worksheet) => worksheet.status === "blocked").length;
  const expectedStatus = blockedWorksheetCount === 0 ? "completed" : blockedWorksheetCount === report.worksheets.length ? "blocked" : "partiallyBlocked";
  if (report.status !== expectedStatus) context.addIssue({ code: z.ZodIssueCode.custom, message: "report status must match worksheet blocking", path: ["status"] });
  report.worksheets.forEach((worksheet, index) => {
    const shouldBlock = worksheet.tolerancePathImageStatus === "unavailable" || worksheet.rows.some((row) => row.missingRequiredFields.length > 0);
    if ((worksheet.status === "blocked") !== shouldBlock) context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet status must match required input gaps", path: ["worksheets", index, "status"] });
  });
  const expectedSummary = {
    worksheetsChecked: report.worksheets.length,
    blockedWorksheetCount,
    readyWorksheetCount: report.worksheets.length - blockedWorksheetCount,
    factorRowCount: rows.length,
    rowsWithRequiredMissing: rows.filter((row) => row.missingRequiredFields.length > 0).length,
    requiredMissingFieldCount: rows.reduce((count, row) => count + row.missingRequiredFields.length, 0),
    missingImageWorksheetCount: report.worksheets.filter((worksheet) => worksheet.tolerancePathImageStatus === "unavailable").length,
    internalWithinGuidanceCount: rows.filter((row) => row.capabilityStatus === "internal_within_guidance").length,
    internalGuidanceExceededCount: rows.filter((row) => row.capabilityStatus === "internal_guidance_exceeded").length,
    f0InformationInsufficientCount: rows.filter((row) => row.capabilityStatus === "f0_information_insufficient").length,
    publicLibraryMatchCount: rows.filter((row) => row.capabilityStatus.startsWith("in_library_")).length,
    nonF0ProcessCategoryCount: rows.filter((row) => row.capabilityStatus === "non_f0_process_category").length,
    unableToCheckCount: rows.filter((row) => row.capabilityStatus === "unable_to_check").length,
    publicToleranceDifferenceCount: rows.filter((row) => row.capabilityStatus === "in_library_tolerance_outside" || row.capabilityStatus === "in_library_tolerance_and_distribution_differ").length,
    publicDistributionDifferenceCount: rows.filter((row) => row.capabilityStatus === "in_library_distribution_differs" || row.capabilityStatus === "in_library_tolerance_and_distribution_differ").length,
    missingDimIdCount: rows.filter((row) => row.missingIdentifiers.includes("dimCharacteristicId")).length,
    missingPartNumberCount: rows.filter((row) => row.missingIdentifiers.includes("partNumber")).length,
  };
  for (const [field, value] of Object.entries(expectedSummary)) {
    if (report.summary[field as keyof typeof expectedSummary] !== value) context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must match report records`, path: ["summary", field] });
  }
});

const f2InputRejectedReportSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  status: z.literal("inputRejected"),
  artifactRoot: z.string().min(1),
  artifactIssues: z.array(z.object({
    reasonCode: z.enum(["root_json_missing", "root_md_missing", "manifest_missing", "worksheet_json_missing", "worksheet_md_missing", "workbook_identity_mismatch", "image_missing", "image_empty", "image_unsupported", "path_outside_root", "invalid_json", "invalid_contract"]),
    artifactPath: z.string().min(1),
  }).strict()).min(1),
}).strict();

export const f2UserReportSchema = z.union([
  f2InputRejectedReportSchema,
  f2AcceptedReportSchema,
]);

export type DataClassification = z.infer<typeof dataClassificationSchema>;
export type RunRequest = z.infer<typeof runRequestSchema>;
export type CapabilityTier = z.infer<typeof capabilityTierSchema>;
export type Distribution = z.infer<typeof distributionSchema>;
export type KnowledgeLibraryId = z.infer<typeof knowledgeLibraryIdSchema>;
export type KnowledgeBaseVersion = z.infer<typeof knowledgeBaseVersionSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type CapabilityEntry = z.infer<typeof capabilityEntrySchema>;
export type CapabilityItemMapping = z.infer<typeof capabilityItemMappingSchema>;
export type CapabilityItemMatchResult = z.infer<typeof capabilityItemMatchResultSchema>;
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
export type F2InitialWorkflowRequest = z.infer<typeof f2InitialWorkflowRequestSchema>;
export type F2InitialWorkflowResult = z.infer<typeof f2InitialWorkflowResultSchema>;
export type F2ArtifactInput = z.infer<typeof f2ArtifactInputSchema>;
export type F2UserReport = z.infer<typeof f2UserReportSchema>;
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
export type CalculationRequest = z.infer<typeof calculationRequestSchema>;
export type CalculationResult = z.infer<typeof calculationResultSchema>;
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
