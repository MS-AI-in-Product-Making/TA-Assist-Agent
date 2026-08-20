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

const windowsWorkbookForbiddenCharacters = new RegExp(
  `[<>:"/\\\\|?*${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}\\u2028\\u2029]`,
);
const windowsReservedDeviceBasenames = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export const workbookCatalogFileNameSchema = z
  .string()
  .min(1)
  .max(240)
  .refine((fileName) => /\.xlsx$/i.test(fileName), {
    message: "fileName must end with .xlsx",
  })
  .superRefine((fileName, context) => {
    if (windowsWorkbookForbiddenCharacters.test(fileName)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileName contains reserved Windows characters or control characters",
      });
      return;
    }

    if (fileName.includes("..")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileName must not contain traversal segments",
      });
    }

    if (/^[A-Za-z]:/.test(fileName)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileName must not be drive-relative",
      });
    }

    if (fileName !== fileName.trimEnd() || fileName.endsWith(".")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileName must not end with a trailing space or dot",
      });
    }

    const fileNameWithoutExtension = fileName.slice(0, -5);
    if (/[ .]$/.test(fileNameWithoutExtension)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileName root must not end with a trailing space or dot",
      });
    }

    const windowsDeviceIdentity = fileNameWithoutExtension.split(".", 1)[0] ?? "";
    if (windowsReservedDeviceBasenames.has(windowsDeviceIdentity.toUpperCase())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileName root must not be a reserved Windows device name",
      });
    }
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

export const worksheetKindSchema = z.enum(["analysis", "example_or_template"]);

export const worksheetSelectionPromptSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    status: z.literal("selectionRequired"),
    workbook: z
      .object({
        fileName: workbookCatalogFileNameSchema,
        contentHash: sha256Schema,
      })
      .strict(),
    options: z
      .array(
        z
          .object({
            selectionIndex: z.number().int().positive(),
            worksheetName: z.string().min(1),
            toleranceLoopDescription: z.string().min(1),
            worksheetKind: worksheetKindSchema,
            source: workbookCatalogAnalysisSourceSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((prompt, context) => {
    const names = prompt.options.map((option) => option.worksheetName);
    if (new Set(names).size !== names.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet option names must be unique", path: ["options"] });
    }
  });

export const worksheetSelectionConfirmationSchema = z
  .object({
    workbookContentHash: sha256Schema,
    selectedWorksheetNames: z.array(z.string().min(1)),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((confirmation, context) => {
    if (new Set(confirmation.selectedWorksheetNames).size !== confirmation.selectedWorksheetNames.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique", path: ["selectedWorksheetNames"] });
    }
  });

export const worksheetSelectionConfirmationResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("confirmed"),
      workbookContentHash: sha256Schema,
      selectedWorksheetNames: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      status: z.literal("cancelled"),
      reasonCode: z.literal("worksheet_selection_empty"),
    })
    .strict(),
  z
    .object({
      status: z.literal("rejected"),
      reasonCode: z.enum(["stale_worksheet_selection", "invalid_worksheet_selection"]),
    })
    .strict(),
]);

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
  "tolerance",
  "oneSigma",
  "percentContributionToSigma",
  "notes",
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

  const availableWorksheetEvidenceNumberSchema = z.object({
      status: z.literal("available"),
      actualValue: z.number().finite(),
      displayValue: z.string(),
      sourceLabel: z.string().min(1),
      sourceCell: worksheetSourceCellSchema.optional(),
      valueOrigin: z.enum(["numeric_literal", "formula_cached", "defaulted"]),
    }).strict();

  export const worksheetEvidenceNumberSchema = z.discriminatedUnion("status", [
    availableWorksheetEvidenceNumberSchema,
    z.object({
      status: z.literal("unavailable"),
      reasonCode: z.enum(["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid"]),
      sourceCell: worksheetSourceCellSchema.optional(),
    }).strict(),
  ]);

  const worksheetSystemSpecificationFields = {
    lowerSpecLimit: worksheetEvidenceNumberSchema,
    upperSpecLimit: worksheetEvidenceNumberSchema,
    targetSigmaLevel: worksheetEvidenceNumberSchema,
    additionalMeanShift: worksheetEvidenceNumberSchema,
  };

  export const worksheetSystemSpecificationSchema = z.discriminatedUnion("status", [
    z.object({ status: z.literal("available"), ...worksheetSystemSpecificationFields }).strict(),
    z.object({
      status: z.literal("unavailable"),
      reasonCode: z.enum(["response_summary_label_missing", "response_summary_label_ambiguous", "system_specification_range_invalid", "legacy_artifact_missing_system_specification"]),
      lowerSpecLimit: worksheetEvidenceNumberSchema.optional(),
      upperSpecLimit: worksheetEvidenceNumberSchema.optional(),
      targetSigmaLevel: worksheetEvidenceNumberSchema.optional(),
      additionalMeanShift: worksheetEvidenceNumberSchema.optional(),
    }).strict(),
  ]);

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
          systemSpecification: worksheetSystemSpecificationSchema.optional(),
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
    cpStatus: capabilityStatusSchema.optional(),
    lowerCpk: z.number().finite(),
    lowerCpkStatus: capabilityStatusSchema.optional(),
    upperCpk: z.number().finite(),
    upperCpkStatus: capabilityStatusSchema.optional(),
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
  .strict()
  .superRefine((overrides, context) => {
    for (const [factorIndex, factor] of overrides.factors.entries()) {
      if (factor.fields.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "factor override fields must include at least one overridden field",
          path: ["factors", factorIndex, "fields"],
        });
      }
    }
    if (overrides.factors.length === 0 && overrides.systemSpecification === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scenario override must include at least one factor override or systemSpecification override",
      });
    }
  });

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

const interpretationSectionSchema = z.enum([
  "calculation-summary",
  "capability-vs-specification",
  "major-contributors",
  "parallel-options",
]);

export const interpretationFactReferenceSchema = z.enum([
  "cpk",
  "targetCpk",
  "achievedSigma",
  "targetSigma",
  "contributors",
]);

const interpretationRequestSourceCellSchema = z.enum([
  "request:systemSpecification.designNominal",
  "request:systemSpecification.lowerSpecLimit",
  "request:systemSpecification.upperSpecLimit",
  "request:systemSpecification.targetSigmaLevel",
  "request:systemSpecification.targetCpk",
  "request:systemSpecification.additionalMeanShift",
]);

const interpretationOutputSourceCellSchema = z.string().regex(
  /^(?:factors\[(?:0|[1-9]\d*)\]\.(?:mean|halfTolerance|sigma|contribution)|system\.(?:designNominal|mean|additionalMeanShift|worstCaseUpper|worstCaseLower|rssSigma)|capability\.(?:lowerSpecLimit|upperSpecLimit|targetSigmaLevel|targetCpk|cp|cpStatus|lowerCpk|lowerCpkStatus|upperCpk|upperCpkStatus|cpk|lowerZ|upperZ|lowerDpm|upperDpm|totalDpm|outOfSpecRatio|yield|status))$/,
);

const interpretationSourceCellSchema = z.union([
  worksheetSourceCellSchema,
  interpretationRequestSourceCellSchema,
  interpretationOutputSourceCellSchema,
]);

const interpretationTraceRecordSchema = calculationTraceRecordSchema.extend({
  sourceCells: z.array(interpretationSourceCellSchema).min(1),
});

const interpretationFormulaOutputProvenanceFields = {
  provenanceKind: z.literal("formula_output"),
  outputField: z.string().min(1),
  traceRecords: z.array(interpretationTraceRecordSchema).min(1).max(500),
} as const;

const interpretationCalculationInputFieldSchema = z.enum([
  "capability.targetCpk",
  "capability.targetSigmaLevel",
  "capability.lowerSpecLimit",
  "capability.upperSpecLimit",
  "recommendation.method",
]);

const interpretationFormulaNumericFactContentSchema = z
  .object({
    metric: z.enum([
      "cpk",
      "cp",
      "rss_sigma",
      "total_dpm",
      "yield",
    ]),
    value: z.number().finite(),
    unit: z.string().min(1).optional(),
    ...interpretationFormulaOutputProvenanceFields,
  })
  .strict();

const interpretationCalculationInputNumericFactContentSchema = z
  .object({
    metric: z.enum([
      "lower_spec_limit",
      "upper_spec_limit",
      "target_cpk",
      "target_sigma",
    ]),
    value: z.number().finite(),
    unit: z.string().min(1).optional(),
    provenanceKind: z.literal("calculation_input"),
    inputField: interpretationCalculationInputFieldSchema,
  })
  .strict();

const interpretationRecommendedMethodCalculationInputFactContentSchema = z
  .object({
    metric: z.literal("recommended_method"),
    method: calculationMethodSchema,
    reason: z.enum([
      "factor_count_1_to_3",
      "factor_count_4_to_10",
      "factor_count_over_10",
      "criticality_override",
    ]),
    refer3d: z.boolean(),
    criticality: calculationCriticalitySchema,
    criticalityRisk: z.boolean(),
    provenanceKind: z.literal("calculation_input"),
    inputField: interpretationCalculationInputFieldSchema,
  })
  .strict();

const interpretationFactorContributionFactContentSchema = z
  .object({
    metric: z.literal("factor_contribution"),
    factorReference: z.string().min(1),
    contributionPercent: z.number().finite().min(0).max(100),
    unit: z.string().min(1).optional(),
    ...interpretationFormulaOutputProvenanceFields,
  })
  .strict();

const interpretationDerivedAchievedSigmaFactContentSchema = z
  .object({
    metric: z.literal("achieved_sigma"),
    value: z.number().finite(),
    unit: z.string().min(1).optional(),
    provenanceKind: z.literal("derived_from_formula_outputs"),
    sourceOutputFields: z.tuple([
      z.literal("capability.lowerZ"),
      z.literal("capability.upperZ"),
    ]),
    traceRecords: z.array(interpretationTraceRecordSchema).min(1).max(500),
  })
  .strict();

const interpretationFactContentByMetricSchema = z.union([
  interpretationFormulaNumericFactContentSchema,
  interpretationCalculationInputNumericFactContentSchema,
  interpretationRecommendedMethodCalculationInputFactContentSchema,
  interpretationFactorContributionFactContentSchema,
  interpretationDerivedAchievedSigmaFactContentSchema,
]);

const interpretationFactContentSchema = z
  .discriminatedUnion("provenanceKind", [
    z.object({ provenanceKind: z.literal("formula_output") }).passthrough(),
    z.object({ provenanceKind: z.literal("calculation_input") }).passthrough(),
    z.object({ provenanceKind: z.literal("derived_from_formula_outputs") }).passthrough(),
  ])
  .pipe(interpretationFactContentByMetricSchema);

const interpretationRuleStatementEvidenceSchema = z
  .object({
    classification: z.literal("internal"),
    sourceAlias: z.string().min(1),
    sourceVersion: z.string().min(1),
    sheetName: z.string().min(1),
    sourceRange: z.string().regex(/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/),
    sourceFileHash: sha256Schema,
    owner: z.string().min(1),
    confidence: z.number().finite().min(0).max(1),
    effectiveVersion: z.literal("interpretation-rules-v1"),
    changeSummary: z.string().min(1),
  })
  .strict();

export const interpretationRuleVersionSchema = z.literal("interpretation-rules-v1");

export const interpretationApplicabilitySchema = z
  .object({
    analysisDimension: z.literal("one-dimensional"),
    method: z.enum(["rss", "worst-case"]).optional(),
  })
  .strict();

const interpretationRuleStatementContentSchema = z
  .object({
    entryId: z.string().min(1),
    effectiveVersion: interpretationRuleVersionSchema,
    applicability: interpretationApplicabilitySchema,
    relatedFactReferences: z.array(interpretationFactReferenceSchema).min(1),
    evidence: interpretationRuleStatementEvidenceSchema,
  })
  .strict();

const interpretationSignalStatementContentSchema = z
  .object({
    ...interpretationRuleStatementContentSchema.shape,
    requiresEngineeringReview: z.literal(true),
  })
  .strict();

const interpretationOptionStatementContentSchema = z
  .object({
    ...interpretationRuleStatementContentSchema.shape,
    rank: z.null(),
  })
  .strict();

const interpretationFactStatementSchema = z
  .object({
    statementId: z.string().min(1),
    type: z.literal("FACT"),
    section: interpretationSectionSchema,
    content: interpretationFactContentSchema,
  })
  .strict();

const interpretationRuleStatementSchema = z
  .object({
    statementId: z.string().min(1),
    type: z.literal("RULE"),
    section: z.literal("capability-vs-specification"),
    content: interpretationRuleStatementContentSchema,
  })
  .strict();

const interpretationSignalStatementSchema = z
  .object({
    statementId: z.string().min(1),
    type: z.literal("SIGNAL"),
    section: z.literal("major-contributors"),
    content: interpretationSignalStatementContentSchema,
  })
  .strict();

const interpretationOptionStatementSchema = z
  .object({
    statementId: z.string().min(1),
    type: z.literal("OPTION"),
    section: z.literal("parallel-options"),
    content: interpretationOptionStatementContentSchema,
  })
  .strict();

const interpretationStatementSchema = z.discriminatedUnion("type", [
  interpretationFactStatementSchema,
  interpretationRuleStatementSchema,
  interpretationSignalStatementSchema,
  interpretationOptionStatementSchema,
]);

const interpretationClarificationFields = {
  clarificationId: z.string().min(1),
  message: z.string().min(1),
  relatedFactReferences: z.array(z.string().min(1)).optional(),
};

const drawingEvidenceScopes = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
  "cross_subsystem",
] as const;

const drawingEvidenceScopesSchema = z
  .array(z.enum(drawingEvidenceScopes))
  .length(drawingEvidenceScopes.length)
  .refine(
    (scopes) => scopes.every((scope, index) => scope === drawingEvidenceScopes[index]),
    "drawing evidence scopes must use the complete stable sequence",
  );

const interpretationClarificationSchema = z.discriminatedUnion("reasonCode", [
  z.object({
    ...interpretationClarificationFields,
    reasonCode: z.literal("drawing_evidence_not_evaluated"),
    scopes: drawingEvidenceScopesSchema,
  }).strict(),
  z.object({
    ...interpretationClarificationFields,
    reasonCode: z.literal("rule_method_not_applicable"),
  }).strict(),
  z.object({
    ...interpretationClarificationFields,
    reasonCode: z.literal("rule_facts_insufficient"),
    missingFacts: z.array(interpretationFactReferenceSchema).min(1),
  }).strict(),
  z.object({
    ...interpretationClarificationFields,
    reasonCode: z.literal("three_dimensional_follow_up_required"),
  }).strict(),
]);

export const interpretationRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    calculationResult: calculationCompletedResultSchema,
  })
  .strict();

export const f5ObjectiveInterpretationCompletedResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F5.1"),
    status: z.literal("completed"),
    interpretationVersion: z.literal("objective-interpretation-v1"),
    projectReference: controlledInterpretationReferenceSchema,
    runReference: controlledInterpretationReferenceSchema,
    workbookContentHash: sha256Schema,
    worksheetSelection: calculationWorksheetSelectionSchema,
    calculationVersion: z.literal("excel-ta-v1"),
    knowledgeBaseVersion: z.literal("interpretation-rules-v1"),
    ruleEvaluationStatus: z.enum(["matched", "insufficient-facts", "not-applicable"]),
    statements: z.array(interpretationStatementSchema),
    clarifications: z.array(interpretationClarificationSchema),
  })
  .strict()
  .superRefine((result, context) => {
    const drawingClarificationCount = result.clarifications.filter(
      ({ reasonCode }) => reasonCode === "drawing_evidence_not_evaluated",
    ).length;
    if (drawingClarificationCount !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "completed interpretation requires exactly one drawing evidence clarification",
        path: ["clarifications"],
      });
    }

    validateInterpretationStatements(result.statements, context);

    if (result.ruleEvaluationStatus === "matched") {
      if (!result.statements.some((statement) => statement.type === "RULE")) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "matched rule evaluation requires at least one RULE statement",
          path: ["statements"],
        });
      }
    } else {
      const derivedStatementIndex = result.statements.findIndex(
        (statement) => statement.type !== "FACT",
      );
      if (derivedStatementIndex >= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "rule-derived statements require matched rule evaluation",
          path: ["statements", derivedStatementIndex],
        });
      }

      const requiredReasonCode = result.ruleEvaluationStatus === "insufficient-facts"
        ? "rule_facts_insufficient"
        : "rule_method_not_applicable";
      if (!result.clarifications.some((clarification) => clarification.reasonCode === requiredReasonCode)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${result.ruleEvaluationStatus} requires ${requiredReasonCode} clarification`,
          path: ["clarifications"],
        });
      }
    }

  });

function validateInterpretationFactProvenance(
  content: z.infer<typeof interpretationFactContentSchema>,
  statementIndex: number,
  context: z.RefinementCtx,
): void {
  const expectedFormulaOutputFields: Record<string, string | RegExp> = {
    cpk: "capability.cpk",
    cp: "capability.cp",
    rss_sigma: "system.rssSigma",
    total_dpm: "capability.totalDpm",
    yield: "capability.yield",
    factor_contribution: /^factors\[(?:0|[1-9]\d*)\]\.contribution$/,
  };
  const expectedFormulaOutputField = expectedFormulaOutputFields[content.metric];
  if (content.provenanceKind === "formula_output"
    && expectedFormulaOutputField !== undefined
    && (typeof expectedFormulaOutputField === "string"
      ? content.outputField !== expectedFormulaOutputField
      : !expectedFormulaOutputField.test(content.outputField))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${content.metric} must use its calculation output field`,
      path: ["statements", statementIndex, "content", "outputField"],
    });
  }

  if (content.provenanceKind === "formula_output") {
    const expectedFormulaId = interpretationFormulaIdForOutputField(content.outputField);
    content.traceRecords.forEach((traceRecord, traceIndex) => {
      if (expectedFormulaId !== undefined && traceRecord.formulaId !== expectedFormulaId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${content.outputField} must use formula ${expectedFormulaId}`,
          path: ["statements", statementIndex, "content", "traceRecords", traceIndex, "formulaId"],
        });
      }
    });
  }

  if (content.provenanceKind === "derived_from_formula_outputs") {
    content.traceRecords.forEach((traceRecord, traceIndex) => {
      const expectedFormulaId = interpretationFormulaIdForOutputField(traceRecord.outputField);
      if (expectedFormulaId !== undefined && traceRecord.formulaId !== expectedFormulaId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${traceRecord.outputField} must use formula ${expectedFormulaId}`,
          path: ["statements", statementIndex, "content", "traceRecords", traceIndex, "formulaId"],
        });
      }
    });
  }

  const expectedInputFields: Partial<Record<typeof content.metric, string>> = {
    target_cpk: "capability.targetCpk",
    target_sigma: "capability.targetSigmaLevel",
    lower_spec_limit: "capability.lowerSpecLimit",
    upper_spec_limit: "capability.upperSpecLimit",
    recommended_method: "recommendation.method",
  };
  const expectedInputField = expectedInputFields[content.metric];
  if (content.provenanceKind === "calculation_input" && content.inputField !== expectedInputField) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${content.metric} must use calculation input ${expectedInputField}`,
      path: ["statements", statementIndex, "content", "inputField"],
    });
  }

  if (content.provenanceKind === "formula_output" && expectedInputField !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${content.metric} must use calculation_input provenance`,
      path: ["statements", statementIndex, "content", "provenanceKind"],
    });
  }

  if (content.provenanceKind === "derived_from_formula_outputs" && content.metric !== "achieved_sigma") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "only achieved_sigma may derive from formula outputs",
      path: ["statements", statementIndex, "content", "provenanceKind"],
    });
  }
}

const interpretationFactSectionByMetric: Record<
  z.infer<typeof interpretationFactContentSchema>["metric"],
  z.infer<typeof interpretationSectionSchema>
> = {
  cpk: "capability-vs-specification",
  cp: "calculation-summary",
  rss_sigma: "calculation-summary",
  total_dpm: "calculation-summary",
  yield: "calculation-summary",
  lower_spec_limit: "capability-vs-specification",
  upper_spec_limit: "capability-vs-specification",
  target_cpk: "capability-vs-specification",
  target_sigma: "calculation-summary",
  recommended_method: "calculation-summary",
  factor_contribution: "major-contributors",
  achieved_sigma: "calculation-summary",
};

function interpretationFormulaIdForOutputField(outputField: string): string | undefined {
  const formulaIds: Readonly<Record<string, string>> = {
    "capability.cpk": "cpk-v1",
    "capability.cp": "cp-v1",
    "system.rssSigma": "rss-v1",
    "capability.totalDpm": "dpm-total-v1",
    "capability.yield": "yield-v1",
    "capability.lowerZ": "z-lower-v1",
    "capability.upperZ": "z-upper-v1",
  };
  return /^factors\[(?:0|[1-9]\d*)\]\.contribution$/.test(outputField)
    ? "contribution-v1"
    : formulaIds[outputField];
}

function hasInterpretationFact(
  statements: readonly z.infer<typeof interpretationStatementSchema>[],
  reference: z.infer<typeof interpretationFactReferenceSchema>,
): boolean {
  const metric = reference === "cpk"
    ? "cpk"
    : reference === "targetCpk"
      ? "target_cpk"
      : reference === "achievedSigma"
        ? "achieved_sigma"
        : reference === "targetSigma"
          ? "target_sigma"
          : "factor_contribution";
  return statements.some((statement) => statement.type === "FACT" && statement.content.metric === metric);
}

function validateInterpretationStatements(
  statements: readonly z.infer<typeof interpretationStatementSchema>[],
  context: z.RefinementCtx,
): void {
  const statementIds = statements.map(({ statementId }) => statementId);
  if (new Set(statementIds).size !== statementIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "statementId must be unique", path: ["statements"] });
  }

  statements.forEach((statement, statementIndex) => {
    if (statement.type === "FACT") {
      const expectedSection = interpretationFactSectionByMetric[statement.content.metric];
      if (statement.section !== expectedSection) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${statement.content.metric} FACT must use section ${expectedSection}`,
          path: ["statements", statementIndex, "section"],
        });
      }

      if (statement.content.provenanceKind === "formula_output") {
        const { outputField } = statement.content;
        statement.content.traceRecords.forEach((traceRecord, traceIndex) => {
          if (traceRecord.outputField !== outputField) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "FACT trace outputField must match FACT outputField",
              path: ["statements", statementIndex, "content", "traceRecords", traceIndex, "outputField"],
            });
          }
        });
      } else if (statement.content.provenanceKind === "derived_from_formula_outputs") {
        const sourceOutputFields = new Set<string>(statement.content.sourceOutputFields);
        const traceOutputFields = statement.content.traceRecords.map(({ outputField }) => outputField);
        if (traceOutputFields.some((outputField) => !sourceOutputFields.has(outputField))
          || new Set(traceOutputFields).size !== traceOutputFields.length
          || statement.content.sourceOutputFields.some((outputField) => !traceOutputFields.includes(outputField))) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "derived FACT traces must correspond to and cover sourceOutputFields",
            path: ["statements", statementIndex, "content", "traceRecords"],
          });
        }
      }

      validateInterpretationFactProvenance(statement.content, statementIndex, context);
      return;
    }

    statement.content.relatedFactReferences.forEach((reference, referenceIndex) => {
      if (!hasInterpretationFact(statements, reference)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${reference} must be represented by a FACT statement`,
          path: ["statements", statementIndex, "content", "relatedFactReferences", referenceIndex],
        });
      }
    });
  });

  const scalarMetricIndexes = new Map<string, number>();
  const factorReferenceIndexes = new Map<string, number>();
  statements.forEach((statement, statementIndex) => {
    if (statement.type !== "FACT") return;
    const key = statement.content.metric === "factor_contribution"
      ? statement.content.factorReference
      : statement.content.metric;
    const indexes = statement.content.metric === "factor_contribution"
      ? factorReferenceIndexes
      : scalarMetricIndexes;
    if (indexes.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: statement.content.metric === "factor_contribution"
          ? "factor_contribution factorReference must be unique"
          : `scalar FACT metric ${statement.content.metric} must be unique`,
        path: ["statements", statementIndex, "content"],
      });
    } else {
      indexes.set(key, statementIndex);
    }
  });
}

const interpretationLegacyUnavailableResultSchema = z
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

export const interpretationResultSchema = z.union([
  f5ObjectiveInterpretationCompletedResultSchema,
  interpretationLegacyUnavailableResultSchema,
]);

const f4WorkflowResultSummarySchema = z
  .object({
    selectedWorksheetCount: z.number().int().positive(),
    completedWorksheetCount: z.number().int().positive(),
  })
  .strict();

export const f4WorkflowCalculationResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    workflowVersion: z.literal("f4-f2-v1"),
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F4"),
    status: z.literal("completed"),
    runId: controlledCalculationReferenceSchema,
    generatedAt: z.string().datetime(),
    source: z
      .object({
        artifactReference: z.literal("Feature2-Report.json"),
        workbookFileName: workbookCatalogFileNameSchema,
        workbookContentHash: sha256Schema,
      })
      .strict(),
    calculations: z.array(calculationCompletedResultSchema).min(1).max(100),
    summary: f4WorkflowResultSummarySchema,
  })
  .strict()
  .superRefine((result, context) => {
    const worksheetNames = result.calculations.map((calculation) => calculation.worksheetSelection.worksheetName);
    if (new Set(worksheetNames).size !== worksheetNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheet names must be unique",
        path: ["calculations"],
      });
    }

    if (result.calculations.some((calculation) => calculation.workbookContentHash !== result.source.workbookContentHash)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "all calculations must match source workbookContentHash",
        path: ["calculations"],
      });
    }

    const completedCalculationCount = result.calculations.length;

    if (result.summary.selectedWorksheetCount !== completedCalculationCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "summary.selectedWorksheetCount must equal calculations length",
        path: ["summary", "selectedWorksheetCount"],
      });
    }
    if (result.summary.completedWorksheetCount !== completedCalculationCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "summary.completedWorksheetCount must equal calculations length",
        path: ["summary", "completedWorksheetCount"],
      });
    }
  });

const f4ExcelComparisonMetricSchema = z
  .object({
    metric: z.string().min(1),
    f4Value: z.number().finite(),
    excelValue: z.number().finite(),
    excelDisplayText: z.string().min(1),
    absoluteDifference: z.number().finite().min(0),
    relativeDifference: z.number().finite().min(0),
    tolerance: z.number().finite().min(0).max(1e-12),
    passed: z.boolean(),
    sourceCell: worksheetSourceCellSchema,
    excelFormula: z.string().trim().min(1),
    f4FormulaId: z.string().trim().min(1),
  })
  .strict()
  .superRefine((metric, context) => {
    const nearEqual = (left: number, right: number): boolean => {
      const epsilon = 1e-12;
      const delta = Math.abs(left - right);
      const scale = Math.max(1, Math.abs(left), Math.abs(right));
      return delta <= epsilon * scale;
    };

    const denominator = Math.max(1, Math.abs(metric.f4Value), Math.abs(metric.excelValue));
    const expectedAbsoluteDifference = Math.abs(metric.f4Value - metric.excelValue);
    const expectedRelativeDifference = expectedAbsoluteDifference / denominator;

    if (!Number.isFinite(expectedAbsoluteDifference)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "derived absoluteDifference must be finite",
        path: ["absoluteDifference"],
      });
      return;
    }

    if (!Number.isFinite(expectedRelativeDifference)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "derived relativeDifference must be finite",
        path: ["relativeDifference"],
      });
      return;
    }

    const expectedToleranceThreshold = metric.tolerance * denominator;
    if (!Number.isFinite(expectedToleranceThreshold)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "derived tolerance threshold must be finite",
        path: ["passed"],
      });
      return;
    }

    const expectedPassed = expectedAbsoluteDifference <= expectedToleranceThreshold;

    if (!nearEqual(metric.absoluteDifference, expectedAbsoluteDifference)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "absoluteDifference must equal abs(f4Value - excelValue)",
        path: ["absoluteDifference"],
      });
    }

    if (!nearEqual(metric.relativeDifference, expectedRelativeDifference)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "relativeDifference must equal absoluteDifference / max(1, abs(f4Value), abs(excelValue))",
        path: ["relativeDifference"],
      });
    }

    if (metric.passed !== expectedPassed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "passed must equal absoluteDifference <= tolerance * max(1, abs(f4Value), abs(excelValue))",
        path: ["passed"],
      });
    }
  });

const f4ExcelComparisonWorksheetSchema = z
  .object({
    worksheetName: z.string().min(1),
    metrics: z.array(f4ExcelComparisonMetricSchema).min(1),
  })
  .strict();

const f4ExcelComparisonSummarySchema = z
  .object({
    worksheetCount: z.number().int().positive(),
    metricCount: z.number().int().positive(),
    passedMetricCount: z.number().int().min(0),
    mismatchMetricCount: z.number().int().min(0),
  })
  .strict();

const f4ExcelComparisonPassedSchema = z
  .object({
    contractVersion: contractVersionSchema,
    comparisonVersion: z.literal("f4-excel-comparison-v1"),
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F4"),
    status: z.literal("passed"),
    runId: controlledCalculationReferenceSchema,
    generatedAt: z.string().datetime(),
    source: z
      .object({
        workbookContentHash: sha256Schema,
      })
      .strict(),
    worksheets: z.array(f4ExcelComparisonWorksheetSchema).min(1),
    summary: f4ExcelComparisonSummarySchema,
  })
  .strict();

const f4ExcelComparisonMismatchSchema = z
  .object({
    contractVersion: contractVersionSchema,
    comparisonVersion: z.literal("f4-excel-comparison-v1"),
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F4"),
    status: z.literal("mismatch"),
    runId: controlledCalculationReferenceSchema,
    generatedAt: z.string().datetime(),
    source: z
      .object({
        workbookContentHash: sha256Schema,
      })
      .strict(),
    worksheets: z.array(f4ExcelComparisonWorksheetSchema).min(1),
    summary: f4ExcelComparisonSummarySchema,
  })
  .strict();

const f4ExcelComparisonExcelUnavailableSchema = z
  .object({
    contractVersion: contractVersionSchema,
    comparisonVersion: z.literal("f4-excel-comparison-v1"),
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F4"),
    status: z.literal("excel_unavailable"),
    runId: controlledCalculationReferenceSchema,
    generatedAt: z.string().datetime(),
    reasonCode: z.enum([
      "excel_runtime_unavailable",
      "excel_execution_failed",
      "excel_output_unavailable",
    ]),
  })
  .strict();

const f4ExcelComparisonMappingErrorSchema = z
  .object({
    contractVersion: contractVersionSchema,
    comparisonVersion: z.literal("f4-excel-comparison-v1"),
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F4"),
    status: z.literal("mapping_error"),
    runId: controlledCalculationReferenceSchema,
    generatedAt: z.string().datetime(),
    reasonCode: z.enum([
      "worksheet_mapping_missing",
      "metric_mapping_missing",
      "formula_evidence_missing",
    ]),
  })
  .strict();

export const f4ExcelComparisonResultSchema = z
  .discriminatedUnion("status", [
    f4ExcelComparisonPassedSchema,
    f4ExcelComparisonMismatchSchema,
    f4ExcelComparisonExcelUnavailableSchema,
    f4ExcelComparisonMappingErrorSchema,
  ])
  .superRefine((result, context) => {
    if (result.status !== "passed" && result.status !== "mismatch") {
      return;
    }

    const worksheetNames = result.worksheets.map((worksheet) => worksheet.worksheetName);
    if (new Set(worksheetNames).size !== worksheetNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheet names must be unique",
        path: ["worksheets"],
      });
    }

    for (const [worksheetIndex, worksheet] of result.worksheets.entries()) {
      const metricIdentities = worksheet.metrics.map((metric) => `${metric.metric}::${metric.sourceCell}`);
      if (new Set(metricIdentities).size !== metricIdentities.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "metric identities must be unique per worksheet",
          path: ["worksheets", worksheetIndex, "metrics"],
        });
      }
    }

    const computedWorksheetCount = result.worksheets.length;
    const allMetrics = result.worksheets.flatMap((worksheet) => worksheet.metrics);
    const computedMetricCount = allMetrics.length;
    const computedPassedMetricCount = allMetrics.filter((metric) => metric.passed).length;
    const computedMismatchMetricCount = allMetrics.filter((metric) => !metric.passed).length;

    if (result.summary.worksheetCount !== computedWorksheetCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "summary.worksheetCount must equal worksheets length",
        path: ["summary", "worksheetCount"],
      });
    }
    if (result.summary.metricCount !== computedMetricCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "summary.metricCount must equal metrics length",
        path: ["summary", "metricCount"],
      });
    }
    if (result.summary.passedMetricCount !== computedPassedMetricCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "summary.passedMetricCount must equal passed metrics",
        path: ["summary", "passedMetricCount"],
      });
    }
    if (result.summary.mismatchMetricCount !== computedMismatchMetricCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "summary.mismatchMetricCount must equal mismatched metrics",
        path: ["summary", "mismatchMetricCount"],
      });
    }

    if (result.status === "passed" && computedMismatchMetricCount !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "passed status requires zero mismatched metrics",
        path: ["status"],
      });
    }

    if (result.status === "mismatch" && computedMismatchMetricCount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mismatch status requires at least one mismatched metric",
        path: ["status"],
      });
    }
  });

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

const interpretationRuleEvidenceSchema = interpretationProvenanceSchema;

const interpretationMatchedRuleSchema = z
  .object({
    entryId: z.string().min(1),
    entryType: z.enum(["performance-rule", "root-cause-signal", "improvement-option"]),
    effectiveVersion: interpretationRuleVersionSchema,
    applicability: interpretationApplicabilitySchema,
    relatedFactReferences: z.array(interpretationFactReferenceSchema),
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

const f2DisplayFieldsSchema = z.object({
  factorName: z.string().nullable(),
  partName: z.string().nullable(),
  drawingNumber: z.string().nullable(),
  dimCharacteristicId: z.string().nullable(),
  partCategory: z.string().nullable(),
  nominalValue: z.string().nullable(),
  upperTolerance: z.string().nullable(),
  lowerTolerance: z.string().nullable(),
  longTermSafetyFactor: z.string().nullable(),
  sigmaLevel: z.string().nullable(),
  distribution: z.string().nullable(),
  mean: z.string().nullable(),
  tolerance: z.string().nullable(),
  oneSigma: z.string().nullable(),
  percentContributionToSigma: z.string().nullable(),
  notes: z.string().nullable(),
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
  z.object({
    status: z.literal("available"),
    imagePath: relativeArtifactPathSchema,
    contentHash: sha256Schema,
    mediaType: z.enum(["image/png", "image/jpeg"]),
  }).strict(),
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
    toleranceLoopDescription: z.string().min(1).optional(),
    systemSpecification: worksheetSystemSpecificationSchema,
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

const f1ImageReferenceSchema = z.object({
  artifact: z.literal("f1"),
  relativePath: relativeArtifactPathSchema,
  contentHash: sha256Schema,
  worksheetName: z.string().min(1),
}).strict();

const f2EnhancedRowSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  actualFields: f2ActualFieldsSchema,
  displayFields: f2DisplayFieldsSchema.optional(),
  sourceCells: z.record(worksheetFieldNameSchema, worksheetSourceCellSchema),
  imageReference: f1ImageReferenceSchema.optional(),
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

export const f2SystemSpecificationIssueSchema = z.object({
  field: z.enum(["lowerSpecLimit", "upperSpecLimit", "targetSigmaLevel"]),
  reasonCode: z.enum([
    "response_summary_label_missing",
    "response_summary_label_ambiguous",
    "response_summary_value_missing",
    "response_summary_value_invalid",
    "system_specification_range_invalid",
    "legacy_artifact_missing_system_specification",
  ]),
  sourceCell: worksheetSourceCellSchema.optional(),
}).strict();

const f4HandoffFactorSchema = z.object({
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  unit: z.literal("mm"),
  actualFields: f2ActualFieldsSchema,
  sourceCells: z.record(worksheetFieldNameSchema, worksheetSourceCellSchema),
}).strict();

export const f4HandoffReadySchema = z.object({
  contractVersion: contractVersionSchema,
  handoffVersion: z.literal("f4-handoff-v1"),
  inputClassification: z.literal("confidential"),
  status: z.literal("ready"),
  workbookContentHash: sha256Schema,
  worksheetName: z.string().min(1),
  toleranceLoopDescription: z.string().min(1).optional(),
  systemSpecification: z.object({
    designNominal: z.number().finite(),
    lowerSpecLimit: availableWorksheetEvidenceNumberSchema,
    upperSpecLimit: availableWorksheetEvidenceNumberSchema,
    targetSigmaLevel: availableWorksheetEvidenceNumberSchema,
    targetCpk: z.number().finite().positive(),
    additionalMeanShift: availableWorksheetEvidenceNumberSchema,
  }).strict(),
  factors: z.array(f4HandoffFactorSchema),
}).strict().superRefine((handoff, context) => {
  const specification = handoff.systemSpecification;
  const expectedNominal = (specification.lowerSpecLimit.actualValue + specification.upperSpecLimit.actualValue) / 2;
  const expectedCpk = specification.targetSigmaLevel.actualValue / 3;
  if (specification.lowerSpecLimit.actualValue >= specification.upperSpecLimit.actualValue) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "lowerSpecLimit must be less than upperSpecLimit", path: ["systemSpecification", "lowerSpecLimit"] });
  }
  if (specification.targetSigmaLevel.actualValue <= 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "targetSigmaLevel must be positive", path: ["systemSpecification", "targetSigmaLevel"] });
  }
  if (Math.abs(specification.designNominal - expectedNominal) > 1e-12) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "designNominal must be derived from specification limits", path: ["systemSpecification", "designNominal"] });
  }
  if (Math.abs(specification.targetCpk - expectedCpk) > 1e-12) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "targetCpk must be derived from targetSigmaLevel", path: ["systemSpecification", "targetCpk"] });
  }
});

const f2ReportWorksheetBaseSchema = z.object({
  worksheetName: z.string().min(1),
  toleranceLoopDescription: z.string().min(1).optional(),
  tolerancePathImageStatus: z.enum(["available", "unavailable"]),
  systemSpecification: worksheetSystemSpecificationSchema,
  systemSpecificationIssues: z.array(f2SystemSpecificationIssueSchema),
  rows: z.array(f2EnhancedRowSchema),
  missingFieldSummary: z.array(f2MissingFieldSummarySchema),
});

export const f2ReadyWorksheetSchema = f2ReportWorksheetBaseSchema.extend({
  status: z.literal("ready"),
  systemSpecification: z.object({ status: z.literal("available"), ...worksheetSystemSpecificationFields }).strict(),
  systemSpecificationIssues: z.array(f2SystemSpecificationIssueSchema).length(0),
}).strict();

const f2BlockedWorksheetSchema = f2ReportWorksheetBaseSchema.extend({
  status: z.literal("blocked"),
}).strict();

const f2ReportWorksheetSchema = z.union([f2ReadyWorksheetSchema, f2BlockedWorksheetSchema]);

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
  worksheets: z.array(f2ReportWorksheetSchema).min(1),
  f4Handoffs: z.array(f4HandoffReadySchema),
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
    const shouldBlock = worksheet.tolerancePathImageStatus === "unavailable"
      || worksheet.rows.some((row) => row.missingRequiredFields.length > 0)
      || worksheet.systemSpecificationIssues.length > 0;
    if ((worksheet.status === "blocked") !== shouldBlock) context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet status must match required input gaps", path: ["worksheets", index, "status"] });
    const matchingHandoffs = report.f4Handoffs.filter((handoff) => handoff.worksheetName === worksheet.worksheetName);
    if (worksheet.status === "ready" && matchingHandoffs.length !== 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "ready worksheets require exactly one F4 handoff", path: ["f4Handoffs"] });
    }
    if (worksheet.status === "blocked" && matchingHandoffs.length > 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "blocked worksheets must not have an F4 handoff", path: ["f4Handoffs"] });
    }
  });
  if (report.f4Handoffs.some((handoff) => handoff.workbookContentHash !== report.workbook.contentHash)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "F4 handoff workbook hash must match report", path: ["f4Handoffs"] });
  }
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
    issuePath: z.string().min(1).optional(),
  }).strict()).min(1),
}).strict();

export const f2UserReportSchema = z.union([
  f2InputRejectedReportSchema,
  f2AcceptedReportSchema,
]);

export const f3DimIdStatusSchema = z.enum([
  "missing",
  "suspected_invalid",
  "valid",
  "needs_confirmation",
]);

export const f3GovernanceStatusSchema = z.enum([
  "complete",
  "needs_governance",
  "blocked_for_reminder",
]);

const f3SourceSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  sourceCells: z.record(worksheetFieldNameSchema, worksheetSourceCellSchema),
}).strict();

export const drawingGovernanceRequestV2Schema = z.object({
  contractVersion: contractVersionSchema,
  modelVersion: z.literal("drawing-governance-v2"),
  inputClassification: z.literal("confidential"),
  artifactRoot: z.string().min(1),
  workbook: z.object({
    fileName: z.string().min(1),
    contentHash: sha256Schema,
  }).strict(),
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    toleranceLoopDescription: z.string().min(1),
    f2Status: z.literal("ready"),
    rows: z.array(f2EnhancedRowSchema),
  }).strict().superRefine((worksheet, context) => {
    worksheet.rows.forEach((row, index) => {
      if (row.worksheetName !== worksheet.worksheetName) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "row worksheet must match the containing worksheet", path: ["rows", index, "worksheetName"] });
      }
      if (row.imageReference === undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "F3 rows require an F1 image reference", path: ["rows", index, "imageReference"] });
      } else if (row.imageReference.worksheetName !== worksheet.worksheetName) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "image reference worksheet must match the containing worksheet", path: ["rows", index, "imageReference", "worksheetName"] });
      }
    });
  })).min(1),
}).strict();

const f3QualitySignalSchema = z.enum([
  "drawing_number_missing",
  "dim_id_missing",
  "dim_id_suspected_invalid",
  "dim_id_needs_confirmation",
  "duplicate_conflict",
]);

const f3GovernanceRowSchema = z.object({
  factorInstanceId: sha256Schema,
  drawingDimensionKey: sha256Schema.optional(),
  deviceLevelDim: z.string().min(1),
  dimensionDescription: z.string().min(1),
  partCategory: z.string().min(1),
  partSubsystem: z.string().min(1),
  drawingNumber: z.string().min(1).nullable(),
  dimId: z.string().min(1).nullable(),
  factorDescription: z.string().min(1),
  nominal: z.number().finite(),
  upperTolerance: z.number().finite(),
  lowerTolerance: z.number().finite(),
  sigmaLevel: z.number().finite(),
  dimIdStatus: f3DimIdStatusSchema,
  qualitySignals: z.array(f3QualitySignalSchema),
  governanceStatus: f3GovernanceStatusSchema,
  imageReference: f1ImageReferenceSchema,
  source: f3SourceSchema,
}).strict().superRefine((row, context) => {
  if (row.drawingDimensionKey !== undefined
    && (row.dimIdStatus !== "valid" || row.drawingNumber === null || row.dimId === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "only valid drawing and DIM identifiers may have a formal drawing dimension key",
      path: ["drawingDimensionKey"],
    });
  }
});

export const f5StructuralScopeSchema = z.enum([
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
  "cross_subsystem",
  "non_geometric_variable",
  "long_dimension_chain",
]);

const f5CoreStructuralScopes = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
] as const;

export const f5CoreStructuralScopeSchema = z.enum(f5CoreStructuralScopes);

export const f5EvidenceStatusSchema = z.enum([
  "supported",
  "needs_review",
  "not_evaluated",
  "insufficient_evidence",
  "not_applicable",
]);

function validateF5ObservationConfirmation(
  observation: {
    reviewStatus: "unreviewed" | "confirmed" | "rejected";
    confirmedBy?: string | undefined;
    confirmedAt?: string | undefined;
  },
  context: z.RefinementCtx,
): void {
  const hasConfirmedBy = observation.confirmedBy !== undefined;
  const hasConfirmedAt = observation.confirmedAt !== undefined;
  for (const [field, present] of [["confirmedBy", hasConfirmedBy], ["confirmedAt", hasConfirmedAt]] as const) {
    if (observation.reviewStatus === "confirmed" && !present) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `confirmed observations require ${field}`, path: [field] });
    }
    if (observation.reviewStatus !== "confirmed" && present) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `only confirmed observations may include ${field}`, path: [field] });
    }
  }
}

const f5ImageObservationSchema = z.object({
  scope: f5StructuralScopeSchema,
  observedValue: z.enum(["visible", "not_visible", "ambiguous"]),
  confidence: z.enum(["high", "medium", "low"]),
  visibleBasis: z.string().min(1).max(500),
  reviewStatus: z.enum(["unreviewed", "confirmed", "rejected"]),
  confirmedBy: controlledReferenceSchema.optional(),
  confirmedAt: z.string().datetime().optional(),
}).strict().superRefine(validateF5ObservationConfirmation);

const f5ImageObservationWorksheetSchema = z.object({
  worksheetName: z.string().min(1),
  imageReference: f1ImageReferenceSchema,
  observations: z.array(f5ImageObservationSchema).max(100),
}).strict().superRefine((worksheet, context) => {
  if (worksheet.imageReference.worksheetName !== worksheet.worksheetName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "image reference worksheet must match the containing worksheet",
      path: ["imageReference", "worksheetName"],
    });
  }
  const scopes = worksheet.observations.map(({ scope }) => scope);
  if (new Set(scopes).size !== scopes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "observation scope must be unique within a worksheet", path: ["observations"] });
  }
});

const f5ImageObservationWorksheetsV1Schema = z.array(f5ImageObservationWorksheetSchema).min(1)
  .superRefine((worksheets, context) => {
    const worksheetNames = worksheets.map(({ worksheetName }) => worksheetName);
    if (new Set(worksheetNames).size !== worksheetNames.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique" });
    }
  });

export const f5ImageObservationArtifactV1Schema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  observationVersion: z.literal("f5-image-observation-v1"),
  workbookContentHash: sha256Schema,
  worksheets: f5ImageObservationWorksheetsV1Schema,
}).strict();

export const f5ContextSnapshotRowV2Schema = z.object({
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  partName: z.string().min(1).nullable(),
  partSubsystem: z.string().min(1).nullable(),
  partCategory: z.string().min(1).nullable(),
  factorName: z.string().min(1).nullable(),
  factorDescription: z.string().min(1).nullable(),
  nominal: z.number().finite().nullable(),
  upperTolerance: z.number().finite().nullable(),
  lowerTolerance: z.number().finite().nullable(),
  sigmaLevel: z.number().finite().positive().nullable(),
  sourceCells: z.record(z.string(), z.string().min(1)),
}).strict();

const f5SnapshotRowKey = ({ tableId, sourceRow }: { tableId: string; sourceRow: number }): string => (
  `${tableId}\u0000${sourceRow}`
);

export const f5ContextSnapshotV2Schema = z.object({
  dimensionDescription: z.string().min(1),
  rows: z.array(f5ContextSnapshotRowV2Schema).min(1),
}).strict().superRefine((snapshot, context) => {
  const rowKeys = snapshot.rows.map(f5SnapshotRowKey);
  if (new Set(rowKeys).size !== rowKeys.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "context snapshot row keys must be unique",
      path: ["rows"],
    });
  }
});

function validateF5ContextSnapshotGovernanceRows(
  snapshot: z.infer<typeof f5ContextSnapshotV2Schema>,
  governanceRows: ReadonlyArray<z.infer<typeof f3GovernanceRowSchema>>,
  context: z.RefinementCtx,
): Set<string> {
  const snapshotRowKeys = new Set(snapshot.rows.map(f5SnapshotRowKey));
  const governanceRowByKey = new Map(governanceRows.map((row) => [
    f5SnapshotRowKey(row.source),
    row,
  ]));
  const governanceDimensionDescriptions = new Set(
    governanceRows.map(({ dimensionDescription }) => dimensionDescription),
  );
  if (governanceDimensionDescriptions.size !== 1
    || !governanceDimensionDescriptions.has(snapshot.dimensionDescription)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "context snapshot dimensionDescription must match every F3 governance row",
      path: ["contextSnapshot", "dimensionDescription"],
    });
  }
  const mappedFields = [
    "partSubsystem",
    "partCategory",
    "factorDescription",
    "nominal",
    "upperTolerance",
    "lowerTolerance",
    "sigmaLevel",
  ] as const;

  snapshot.rows.forEach((snapshotRow, snapshotRowIndex) => {
    const governanceRow = governanceRowByKey.get(f5SnapshotRowKey(snapshotRow));
    if (governanceRow === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "context snapshot row must match an F3 governance row",
        path: ["contextSnapshot", "rows", snapshotRowIndex],
      });
      return;
    }
    if (snapshotRow.partName !== snapshotRow.partSubsystem) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "context snapshot partName must match partSubsystem",
        path: ["contextSnapshot", "rows", snapshotRowIndex, "partName"],
      });
    }
    if (snapshotRow.factorName !== snapshotRow.factorDescription) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "context snapshot factorName must match factorDescription",
        path: ["contextSnapshot", "rows", snapshotRowIndex, "factorName"],
      });
    }
    for (const field of mappedFields) {
      if (snapshotRow[field] !== governanceRow[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `context snapshot ${field} must match the F3 governance row`,
          path: ["contextSnapshot", "rows", snapshotRowIndex, field],
        });
      }
    }
    const snapshotSourceCellEntries = Object.entries(snapshotRow.sourceCells);
    const governanceSourceCellEntries = Object.entries(governanceRow.source.sourceCells);
    const governanceSourceCellByField = new Map(governanceSourceCellEntries);
    if (snapshotSourceCellEntries.length !== governanceSourceCellEntries.length
      || snapshotSourceCellEntries.some(([field, sourceCell]) => governanceSourceCellByField.get(field) !== sourceCell)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "context snapshot sourceCells must match the F3 governance row",
        path: ["contextSnapshot", "rows", snapshotRowIndex, "sourceCells"],
      });
    }
  });
  governanceRows.forEach((governanceRow, governanceRowIndex) => {
    if (!snapshotRowKeys.has(f5SnapshotRowKey(governanceRow.source))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "F3 governance row requires a matching context snapshot row",
        path: ["governanceRows", governanceRowIndex, "source"],
      });
    }
  });

  return snapshotRowKeys;
}

export const f5VisualObservationV2Schema = z.object({
  observedValue: z.enum(["visible", "not_visible", "ambiguous"]),
  confidence: z.enum(["high", "medium", "low"]),
  visibleBasis: z.string().min(1).max(500),
  visibleLabels: z.array(z.string().min(1)).superRefine((labels, context) => {
    if (new Set(labels).size !== labels.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "visible labels must be unique" });
    }
  }),
  reviewStatus: z.enum(["unreviewed", "confirmed", "rejected"]),
  confirmedBy: controlledReferenceSchema.optional(),
  confirmedAt: z.string().datetime().optional(),
}).strict().superRefine(validateF5ObservationConfirmation);

const f5LinkedSourceRowV2Schema = z.object({
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
}).strict();

const f5LinkedVisualLabelV2Schema = z.object({
  label: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
}).strict();

export const f5ContextualSignalV2Schema = z.object({
  signalValue: z.enum([
    "indicated_consistent",
    "indicated_conflict",
    "ambiguous",
    "insufficient_evidence",
  ]),
  textBasis: z.string().min(1),
  linkedSourceRows: z.array(f5LinkedSourceRowV2Schema),
  linkedVisualLabels: z.array(f5LinkedVisualLabelV2Schema),
  requiresEngineeringReview: z.literal(true),
}).strict();

export const f5ContextualObservationV2Schema = z.object({
  scope: f5CoreStructuralScopeSchema,
  visualObservation: f5VisualObservationV2Schema,
  contextualSignal: f5ContextualSignalV2Schema,
}).strict();

function validateF5ContextualSignalSemantics(
  scope: z.infer<typeof f5CoreStructuralScopeSchema>,
  contextualSignal: z.infer<typeof f5ContextualSignalV2Schema>,
  context: z.RefinementCtx,
  path: Array<string | number>,
): void {
  const hasVisualLabels = contextualSignal.linkedVisualLabels.length > 0;
  const hasSourceRows = contextualSignal.linkedSourceRows.length > 0;
  const hasIndicatedConclusion = contextualSignal.signalValue === "indicated_consistent"
    || contextualSignal.signalValue === "indicated_conflict";

  if (scope !== "direction" && hasVisualLabels) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "linked visual labels are only supported for direction observations",
      path: [...path, "linkedVisualLabels"],
    });
  }

  if (scope !== "direction") return;

  if (hasIndicatedConclusion && (!hasVisualLabels || !hasSourceRows)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "indicated direction conclusions require linked visual labels and source rows",
      path: [...path, !hasVisualLabels ? "linkedVisualLabels" : "linkedSourceRows"],
    });
  }
  if (!hasVisualLabels && hasSourceRows) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "direction without linked visual labels must not link source rows",
      path: [...path, "linkedSourceRows"],
    });
  }
  if (!hasVisualLabels && hasIndicatedConclusion) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "direction without linked visual labels must be ambiguous or insufficient_evidence",
      path: [...path, "signalValue"],
    });
  }
}

function validateF5ContextualObservationEvidence(
  observation: z.infer<typeof f5ContextualObservationV2Schema>,
  context: z.RefinementCtx,
  path: Array<string | number>,
): void {
  const { contextualSignal, visualObservation } = observation;
  const hasVisualLabels = contextualSignal.linkedVisualLabels.length > 0;
  validateF5ContextualSignalSemantics(
    observation.scope,
    contextualSignal,
    context,
    [...path, "contextualSignal"],
  );

  if (observation.scope === "direction") {
    if (hasVisualLabels && visualObservation.observedValue !== "visible") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "direction linked visual labels require a visible visual observation",
        path: [...path, "visualObservation", "observedValue"],
      });
    }
    const visibleLabelSet = new Set(visualObservation.visibleLabels);
    contextualSignal.linkedVisualLabels.forEach((linkedVisualLabel, linkedLabelIndex) => {
      if (!visibleLabelSet.has(linkedVisualLabel.label)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "direction linked visual labels must reference structured visible labels",
          path: [...path, "contextualSignal", "linkedVisualLabels", linkedLabelIndex, "label"],
        });
      }
    });
  }

  if (visualObservation.observedValue === "visible") return;

  if (observation.scope === "stack_start") {
    if (contextualSignal.linkedSourceRows.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stack_start without a visible marker must not link source rows",
        path: [...path, "contextualSignal", "linkedSourceRows"],
      });
    }
    if (contextualSignal.signalValue !== "ambiguous"
      && contextualSignal.signalValue !== "insufficient_evidence") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stack_start without a visible marker must be ambiguous or insufficient_evidence",
        path: [...path, "contextualSignal", "signalValue"],
      });
    }
  }

  if (observation.scope === "assembly_datum_face"
    && contextualSignal.signalValue === "indicated_consistent") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "assembly_datum_face without a visible marked face cannot be indicated_consistent",
      path: [...path, "contextualSignal", "signalValue"],
    });
  }

}

function validateF5ContextualSignalRowKeySets(
  scope: z.infer<typeof f5CoreStructuralScopeSchema>,
  contextualSignal: z.infer<typeof f5ContextualSignalV2Schema>,
  context: z.RefinementCtx,
  path: Array<string | number>,
): void {
  const linkedSourceRowKeys = contextualSignal.linkedSourceRows.map(f5SnapshotRowKey);
  const linkedVisualLabelKeys = contextualSignal.linkedVisualLabels.map(f5SnapshotRowKey);

  if (new Set(linkedSourceRowKeys).size !== linkedSourceRowKeys.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "linked source row keys must be unique",
      path: [...path, "linkedSourceRows"],
    });
  }
  if (new Set(linkedVisualLabelKeys).size !== linkedVisualLabelKeys.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "linked visual label row keys must be unique",
      path: [...path, "linkedVisualLabels"],
    });
  }

  if (scope === "direction" && (linkedSourceRowKeys.length > 0 || linkedVisualLabelKeys.length > 0)) {
    const linkedSourceRowKeySet = new Set(linkedSourceRowKeys);
    const linkedVisualLabelKeySet = new Set(linkedVisualLabelKeys);
    if (linkedSourceRowKeySet.size !== linkedVisualLabelKeySet.size
      || [...linkedSourceRowKeySet].some((rowKey) => !linkedVisualLabelKeySet.has(rowKey))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "linked visual label row keys must exactly match linked source row keys",
        path: [...path, "linkedVisualLabels"],
      });
    }
  }
}

function validateF5ContextualSignalLinks(
  scope: z.infer<typeof f5CoreStructuralScopeSchema>,
  contextualSignal: z.infer<typeof f5ContextualSignalV2Schema>,
  snapshotRowKeys: Set<string>,
  context: z.RefinementCtx,
  path: Array<string | number>,
): void {
  contextualSignal.linkedSourceRows.forEach((linkedSourceRow, linkedRowIndex) => {
    if (!snapshotRowKeys.has(f5SnapshotRowKey(linkedSourceRow))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "linked source rows must refer to context snapshot rows",
        path: [...path, "linkedSourceRows", linkedRowIndex],
      });
    }
  });
  contextualSignal.linkedVisualLabels.forEach((linkedVisualLabel, linkedLabelIndex) => {
    if (!snapshotRowKeys.has(f5SnapshotRowKey(linkedVisualLabel))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "linked visual labels must refer to context snapshot rows",
        path: [...path, "linkedVisualLabels", linkedLabelIndex],
      });
    }
  });
  validateF5ContextualSignalRowKeySets(scope, contextualSignal, context, path);
}

export const f5ContextualObservationWorksheetV2Schema = z.object({
  worksheetName: z.string().min(1),
  imageReference: f1ImageReferenceSchema,
  contextSnapshot: f5ContextSnapshotV2Schema,
  observations: z.array(f5ContextualObservationV2Schema).length(f5CoreStructuralScopes.length),
}).strict().superRefine((worksheet, context) => {
  if (worksheet.imageReference.worksheetName !== worksheet.worksheetName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "image reference worksheet must match the containing worksheet",
      path: ["imageReference", "worksheetName"],
    });
  }

  const scopes = worksheet.observations.map(({ scope }) => scope);
  if (new Set(scopes).size !== f5CoreStructuralScopes.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "observations must contain each core structural scope exactly once",
      path: ["observations"],
    });
  }

  const snapshotRowKeys = new Set(worksheet.contextSnapshot.rows.map(f5SnapshotRowKey));
  worksheet.observations.forEach((observation, observationIndex) => {
    validateF5ContextualObservationEvidence(observation, context, ["observations", observationIndex]);
    const { contextualSignal } = observation;
    validateF5ContextualSignalLinks(
      observation.scope,
      contextualSignal,
      snapshotRowKeys,
      context,
      ["observations", observationIndex, "contextualSignal"],
    );
    if (contextualSignal.linkedSourceRows.length === 0
      && contextualSignal.signalValue !== "ambiguous"
      && contextualSignal.signalValue !== "insufficient_evidence") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unlinked contextual signals must be ambiguous or insufficient_evidence",
        path: ["observations", observationIndex, "contextualSignal", "signalValue"],
      });
    }
  });
});

const f5ContextualObservationWorksheetsV2Schema = z.array(f5ContextualObservationWorksheetV2Schema).min(1)
  .superRefine((worksheets, context) => {
    const worksheetNames = worksheets.map(({ worksheetName }) => worksheetName);
    if (new Set(worksheetNames).size !== worksheetNames.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique" });
    }
  });

export const f5ImageObservationArtifactV2Schema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  observationVersion: z.literal("f5-image-observation-v2"),
  workbookContentHash: sha256Schema,
  worksheets: f5ContextualObservationWorksheetsV2Schema,
}).strict();

export const f5ImageObservationArtifactSchema = z.discriminatedUnion("observationVersion", [
  f5ImageObservationArtifactV1Schema,
  f5ImageObservationArtifactV2Schema,
]);

const f5DataInterpretationRequestWorksheetBaseSchema = z.object({
  worksheetName: z.string().min(1),
  imageReference: f1ImageReferenceSchema,
  governanceRows: z.array(f3GovernanceRowSchema),
  calculationResult: calculationCompletedResultSchema,
});

const f5DataInterpretationRequestWorksheetV1Schema = f5DataInterpretationRequestWorksheetBaseSchema.extend({
  imageObservations: z.array(f5ImageObservationSchema).max(100),
}).strict();

const f5DataInterpretationRequestWorksheetV2Schema = f5DataInterpretationRequestWorksheetBaseSchema.extend({
  observationVersion: z.literal("f5-image-observation-v2"),
  contextSnapshot: f5ContextSnapshotV2Schema,
  imageObservations: z.array(f5ContextualObservationV2Schema).length(f5CoreStructuralScopes.length),
}).strict();

const f5DataInterpretationRequestWorksheetSchema = z.union([
  f5DataInterpretationRequestWorksheetV1Schema,
  f5DataInterpretationRequestWorksheetV2Schema,
]).superRefine((worksheet, context) => {
  const { worksheetName, imageReference, calculationResult } = worksheet;
  if (imageReference.worksheetName !== worksheetName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "image worksheet must match worksheetName", path: ["imageReference", "worksheetName"] });
  }
  if (calculationResult.worksheetSelection.worksheetName !== worksheetName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "calculation worksheet must match worksheetName", path: ["calculationResult", "worksheetSelection", "worksheetName"] });
  }

  const tableId = calculationResult.worksheetSelection.tableId;
  const sourceKey = (source: { worksheetName: string; tableId: string; sourceRow: number }): string => (
    `${source.worksheetName}\u0000${source.tableId}\u0000${source.sourceRow}`
  );
  const governanceSourceIndexes = new Map<string, number>();
  worksheet.governanceRows.forEach((row, rowIndex) => {
    if (row.source.worksheetName !== worksheetName || row.source.tableId !== tableId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance source must match calculation worksheet and table", path: ["governanceRows", rowIndex, "source"] });
    }
    if (row.imageReference.worksheetName !== worksheetName
      || row.imageReference.relativePath !== imageReference.relativePath
      || row.imageReference.contentHash !== imageReference.contentHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance image must match the worksheet image", path: ["governanceRows", rowIndex, "imageReference"] });
    }
    const key = sourceKey(row.source);
    if (governanceSourceIndexes.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance source key must be unique", path: ["governanceRows", rowIndex, "source"] });
    } else {
      governanceSourceIndexes.set(key, rowIndex);
    }
  });

  const factorSourceIndexes = new Map<string, number>();
  calculationResult.factors.forEach((factor, factorIndex) => {
    if (factor.source.worksheetName !== worksheetName || factor.source.tableId !== tableId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor source must match calculation worksheet and table", path: ["calculationResult", "factors", factorIndex, "source"] });
    }
    const key = sourceKey(factor.source);
    if (factorSourceIndexes.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor source key must be unique", path: ["calculationResult", "factors", factorIndex, "source"] });
    } else {
      factorSourceIndexes.set(key, factorIndex);
    }
    if (!governanceSourceIndexes.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor source must match a governance row", path: ["calculationResult", "factors", factorIndex, "source"] });
    }
  });
  worksheet.governanceRows.forEach((row, rowIndex) => {
    if (!factorSourceIndexes.has(sourceKey(row.source))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance source must match a calculation factor", path: ["governanceRows", rowIndex, "source"] });
    }
  });

  const observationScopes = worksheet.imageObservations.map(({ scope }) => scope);
  const expectedScopeCount = "observationVersion" in worksheet ? f5CoreStructuralScopes.length : observationScopes.length;
  if (new Set(observationScopes).size !== expectedScopeCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "image observations must contain the required scopes exactly once",
      path: ["imageObservations"],
    });
  }

  if ("observationVersion" in worksheet) {
    const snapshotRowKeys = validateF5ContextSnapshotGovernanceRows(
      worksheet.contextSnapshot,
      worksheet.governanceRows,
      context,
    );
    worksheet.imageObservations.forEach((observation, observationIndex) => {
      validateF5ContextualObservationEvidence(observation, context, ["imageObservations", observationIndex]);
      validateF5ContextualSignalLinks(
        observation.scope,
        observation.contextualSignal,
        snapshotRowKeys,
        context,
        ["imageObservations", observationIndex, "contextualSignal"],
      );
      if (observation.contextualSignal.linkedSourceRows.length === 0
        && observation.contextualSignal.signalValue !== "ambiguous"
        && observation.contextualSignal.signalValue !== "insufficient_evidence") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "unlinked contextual signals must be ambiguous or insufficient_evidence",
          path: ["imageObservations", observationIndex, "contextualSignal", "signalValue"],
        });
      }
    });
  }
});

export const f5DataInterpretationRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  workbook: z.object({ fileName: workbookCatalogFileNameSchema, contentHash: sha256Schema }).strict(),
  knowledgeBaseVersion: z.literal("interpretation-rules-v1"),
  observationFallback: z.object({
    reasonCode: z.literal("enhanced_observation_rejected"),
  }).strict().optional(),
  worksheets: z.array(f5DataInterpretationRequestWorksheetSchema).min(1),
}).strict().superRefine((request, context) => {
  const worksheetNames = request.worksheets.map(({ worksheetName }) => worksheetName);
  if (new Set(worksheetNames).size !== worksheetNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique", path: ["worksheets"] });
  }
  request.worksheets.forEach((worksheet, worksheetIndex) => {
    if (request.observationFallback !== undefined) {
      if (worksheet.imageObservations.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "observation fallback requires empty image observations",
          path: ["worksheets", worksheetIndex, "imageObservations"],
        });
      }
      if ("observationVersion" in worksheet) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "observation fallback must not include an observation version",
          path: ["worksheets", worksheetIndex, "observationVersion"],
        });
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "observation fallback must not include a context snapshot",
          path: ["worksheets", worksheetIndex, "contextSnapshot"],
        });
      }
    }
    if (worksheet.calculationResult.workbookContentHash !== request.workbook.contentHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "calculation workbook hash must match request workbook", path: ["worksheets", worksheetIndex, "calculationResult", "workbookContentHash"] });
    }
  });
});

const f5RootRuleStatementSchema = interpretationRuleStatementSchema;

const f5RootImageFactStatementSchema = z.object({
  statementId: z.string().min(1),
  type: z.literal("FACT"),
  section: z.literal("tolerance-chain-validity"),
  content: z.object({
    provenanceKind: z.literal("image_observation"),
    scope: f5StructuralScopeSchema,
    observedValue: z.enum(["visible", "not_visible", "ambiguous"]),
    imageReference: f1ImageReferenceSchema,
    confidence: z.enum(["high", "medium", "low"]),
    visibleBasis: z.string().min(1).max(500),
    visibleLabels: z.array(z.string().min(1)).optional(),
    reviewStatus: z.enum(["unreviewed", "confirmed", "rejected"]),
    confirmedBy: controlledReferenceSchema.optional(),
    confirmedAt: z.string().datetime().optional(),
  }).strict().superRefine((content, context) => {
    validateF5ObservationConfirmation(content, context);
    if (content.confidence !== "high") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "image FACT confidence must be high", path: ["confidence"] });
    }
    if (content.reviewStatus === "rejected") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "image FACT reviewStatus must be unreviewed or confirmed", path: ["reviewStatus"] });
    }
  }),
}).strict();

const f5RootGovernanceFactStatementSchema = z.object({
  statementId: z.string().min(1),
  type: z.literal("FACT"),
  section: z.literal("major-contributors"),
  content: z.object({
    provenanceKind: z.literal("f3_governance"),
    source: f3SourceSchema,
    drawingNumber: z.string().min(1).nullable(),
    dimId: z.string().min(1).nullable(),
    dimIdStatus: f3DimIdStatusSchema,
    governanceStatus: f3GovernanceStatusSchema,
    qualitySignals: z.array(f3QualitySignalSchema),
  }).strict(),
}).strict();

const f5RootObservationEvidenceSchema = z.object({
  scope: f5StructuralScopeSchema,
  observedValue: z.enum(["visible", "not_visible", "ambiguous"]),
  imageReference: f1ImageReferenceSchema,
  confidence: z.enum(["high", "medium", "low"]),
  visibleBasis: z.string().min(1).max(500),
  visibleLabels: z.array(z.string().min(1)).optional(),
  reviewStatus: z.enum(["unreviewed", "confirmed", "rejected"]),
  confirmedBy: controlledReferenceSchema.optional(),
  confirmedAt: z.string().datetime().optional(),
}).strict().superRefine(validateF5ObservationConfirmation);

const f5RootContextVisualEvidenceSchema = z.object({
  observedValue: z.enum(["visible", "not_visible", "ambiguous"]),
  imageReference: f1ImageReferenceSchema,
  confidence: z.enum(["high", "medium", "low"]),
  visibleBasis: z.string().min(1).max(500),
  visibleLabels: z.array(z.string().min(1)).superRefine((labels, context) => {
    if (new Set(labels).size !== labels.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "visible labels must be unique" });
    }
  }),
  reviewStatus: z.enum(["unreviewed", "confirmed", "rejected"]),
  confirmedBy: controlledReferenceSchema.optional(),
  confirmedAt: z.string().datetime().optional(),
}).strict().superRefine(validateF5ObservationConfirmation);

const f5RootSignalStatementSchema = z.union([
  z.object({
    statementId: z.string().min(1),
    type: z.literal("SIGNAL"),
    section: z.literal("tolerance-chain-validity"),
    content: z.object({
      signalKind: z.literal("image_text_context_review"),
      scope: f5CoreStructuralScopeSchema,
      signalValue: z.enum([
        "indicated_consistent",
        "indicated_conflict",
        "ambiguous",
        "insufficient_evidence",
      ]),
      textBasis: z.string().min(1),
      linkedSourceRows: z.array(f5LinkedSourceRowV2Schema),
      linkedVisualLabels: z.array(f5LinkedVisualLabelV2Schema),
      visualEvidence: f5RootContextVisualEvidenceSchema,
      requiresEngineeringReview: z.literal(true),
    }).strict().superRefine((content, context) => {
      validateF5ContextualSignalSemantics(content.scope, content, context, []);
      validateF5ContextualSignalRowKeySets(content.scope, content, context, []);
      if (content.scope === "direction" && content.linkedVisualLabels.length > 0) {
        if (content.visualEvidence.observedValue !== "visible") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "direction linked visual labels require visible SIGNAL evidence",
            path: ["visualEvidence", "observedValue"],
          });
        }
        const visibleLabelSet = new Set(content.visualEvidence.visibleLabels);
        content.linkedVisualLabels.forEach((linkedVisualLabel, linkedLabelIndex) => {
          if (!visibleLabelSet.has(linkedVisualLabel.label)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "context labels must reference visible labels in the same SIGNAL",
              path: ["linkedVisualLabels", linkedLabelIndex, "label"],
            });
          }
        });
      }
    }),
  }).strict(),
  z.object({
    statementId: z.string().min(1),
    type: z.literal("SIGNAL"),
    section: z.literal("tolerance-chain-validity"),
    content: z.object({
      signalKind: z.literal("structural_evidence_review"),
      requiresEngineeringReview: z.literal(true),
      triggerFactReferences: z.array(z.string().min(1)).min(1).optional(),
      observationEvidence: z.array(f5RootObservationEvidenceSchema).min(1).optional(),
    }).strict().superRefine((content, context) => {
      if (content.triggerFactReferences === undefined && content.observationEvidence === undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "SIGNAL requires trigger FACT references or observation evidence" });
      }
    }),
  }).strict(),
  z.object({
    statementId: z.string().min(1),
    type: z.literal("SIGNAL"),
    section: z.literal("major-contributors"),
    content: z.object({
      signalKind: z.literal("identifier_governance_gap"),
      requiresEngineeringReview: z.literal(true),
      triggerFactReferences: z.array(z.string().min(1)).min(1),
    }).strict(),
  }).strict(),
]);

const f5RootInterpretationStatementSchema = z.union([
  interpretationFactStatementSchema,
  f5RootImageFactStatementSchema,
  f5RootGovernanceFactStatementSchema,
  f5RootRuleStatementSchema,
  interpretationSignalStatementSchema,
  f5RootSignalStatementSchema,
  interpretationOptionStatementSchema,
]);

const f5ResultSectionNameSchema = z.enum([
  "toleranceChainValidity",
  "capabilityVsSpecification",
  "majorContributors",
  "reasonableToleranceRange",
  "designOptimizationAndParallelOptions",
]);

const f5MajorContributorItemSchema = z.object({
  factorReference: z.string().min(1),
  factorName: z.string().min(1),
  factorIndex: z.number().int().nonnegative(),
  contributionPercent: z.number().finite().min(0).max(100),
  halfTolerance: z.number().finite().nonnegative(),
  sigma: z.number().finite().nonnegative(),
  unit: z.string().min(1),
  source: z.object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
  }).strict(),
  drawingNumber: z.string().min(1).nullable(),
  partNumber: z.unknown().optional(),
  dimId: z.string().min(1).nullable(),
  governanceStatus: f3GovernanceStatusSchema,
  reasonCodes: z.array(z.enum([
    "contribution_concentration",
    "identifier_governance_gap",
  ])),
  relatedStatementIds: z.array(z.string().min(1)).min(1),
}).strict().superRefine((item, context) => {
  if ("partNumber" in item) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "partNumber is not present in F3 governance provenance", path: ["partNumber"] });
  }
});

const f5ToleranceChainValidityItemSchema = z.object({
  scope: f5StructuralScopeSchema,
  status: f5EvidenceStatusSchema,
  relatedStatementIds: z.array(z.string().min(1)),
  clarificationIds: z.array(z.string().min(1)),
}).strict();

const f5ResultSectionsSchema = z.object({
  toleranceChainValidity: z.object({
    status: f5EvidenceStatusSchema,
    items: z.array(f5ToleranceChainValidityItemSchema).length(8),
  }).strict(),
  capabilityVsSpecification: z.object({
    status: z.literal("supported"),
    statementIds: z.array(z.string().min(1)).min(1),
  }).strict(),
  majorContributors: z.object({
    status: z.literal("supported"),
    items: z.array(f5MajorContributorItemSchema).min(1),
  }).strict(),
  reasonableToleranceRange: z.object({ status: z.literal("delegated_to_f6") }).strict(),
  designOptimizationAndParallelOptions: z.object({ status: z.literal("delegated_to_f6") }).strict(),
}).strict();

const f5ClarificationSchema = z.object({
  clarificationId: z.string().min(1),
  reasonCode: z.string().min(1),
  section: f5ResultSectionNameSchema,
  structuralScope: f5StructuralScopeSchema.optional(),
  missingEvidence: z.array(z.string().min(1)),
  affectedConclusionIds: z.array(z.string().min(1)),
  blockingScope: z.enum(["worksheet", "section", "conclusion"]),
  questionForReviewer: z.string().min(1),
}).strict().superRefine((clarification, context) => {
  if (clarification.section === "toleranceChainValidity" && clarification.structuralScope === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance clarification requires structuralScope", path: ["structuralScope"] });
  }
  if (clarification.section !== "toleranceChainValidity" && clarification.structuralScope !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "structuralScope is only valid for tolerance clarifications", path: ["structuralScope"] });
  }
});

const f5AssumptionSchema = z.object({
  assumptionId: z.string().min(1),
  source: z.string().min(1),
  affectedSections: z.array(f5ResultSectionNameSchema).min(1),
  statement: z.string().min(1),
  status: z.enum(["proposed", "confirmed", "rejected"]),
  confirmedBy: controlledReferenceSchema.optional(),
  confirmedAt: z.string().datetime().optional(),
}).strict().superRefine((assumption, context) => {
  for (const field of ["confirmedBy", "confirmedAt"] as const) {
    const present = assumption[field] !== undefined;
    if (assumption.status === "confirmed" && !present) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `confirmed assumptions require ${field}`, path: [field] });
    }
    if (assumption.status !== "confirmed" && present) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `only confirmed assumptions may include ${field}`, path: [field] });
    }
  }
});

const f5CompletedWorksheetResultSchema = z.object({
  worksheetName: z.string().min(1),
  imageReference: f1ImageReferenceSchema,
  governanceRows: z.array(f3GovernanceRowSchema),
  calculationResult: calculationCompletedResultSchema,
  observationVersion: z.literal("f5-image-observation-v2").optional(),
  contextSnapshot: f5ContextSnapshotV2Schema.optional(),
  status: z.literal("completed"),
  sections: f5ResultSectionsSchema,
  statements: z.array(f5RootInterpretationStatementSchema),
  clarifications: z.array(f5ClarificationSchema),
  assumptions: z.array(f5AssumptionSchema),
}).strict().superRefine((worksheet, context) => {
  if ((worksheet.observationVersion === undefined) !== (worksheet.contextSnapshot === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "completed v2 worksheet results require observationVersion and contextSnapshot together",
      path: [worksheet.observationVersion === undefined ? "observationVersion" : "contextSnapshot"],
    });
  }
  const contextSignalScopes: Array<z.infer<typeof f5CoreStructuralScopeSchema>> = [];
  worksheet.statements.forEach((statement) => {
    if (statement.type === "SIGNAL"
      && "signalKind" in statement.content
      && statement.content.signalKind === "image_text_context_review") {
      contextSignalScopes.push(statement.content.scope);
    }
  });
  if (worksheet.observationVersion === "f5-image-observation-v2") {
    const uniqueContextSignalScopes = new Set(contextSignalScopes);
    if (contextSignalScopes.length !== f5CoreStructuralScopes.length
      || uniqueContextSignalScopes.size !== f5CoreStructuralScopes.length
      || f5CoreStructuralScopes.some((scope) => !uniqueContextSignalScopes.has(scope))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "completed v2 worksheet results require exactly one image-text context SIGNAL for each core scope",
        path: ["statements"],
      });
    }
  } else if (contextSignalScopes.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "image-text context SIGNALs require a completed v2 worksheet result",
      path: ["statements"],
    });
  }
  const legacyStatements: Array<z.infer<typeof interpretationStatementSchema>> = [];
  worksheet.statements.forEach((statement) => {
    if (statement.type === "FACT" && statement.content.provenanceKind === "image_observation") return;
    if (statement.type === "SIGNAL" && "signalKind" in statement.content) return;
    if (statement.type === "RULE") {
      legacyStatements.push(statement);
      return;
    }
    const parsedLegacyStatement = interpretationStatementSchema.safeParse(statement);
    if (parsedLegacyStatement.success) legacyStatements.push(parsedLegacyStatement.data);
  });
  validateInterpretationStatements(legacyStatements, context);
  const statementIds = worksheet.statements.map(({ statementId }) => statementId);
  if (new Set(statementIds).size !== statementIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "statementId must be unique", path: ["statements"] });
  }
  if (worksheet.imageReference.worksheetName !== worksheet.worksheetName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet image must match worksheetName", path: ["imageReference", "worksheetName"] });
  }
  if (worksheet.calculationResult.worksheetSelection.worksheetName !== worksheet.worksheetName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "calculation worksheet must match worksheetName", path: ["calculationResult", "worksheetSelection", "worksheetName"] });
  }
  const sourceKey = (source: { worksheetName: string; tableId: string; sourceRow: number }): string => (
    `${source.worksheetName}\u0000${source.tableId}\u0000${source.sourceRow}`
  );
  const tableId = worksheet.calculationResult.worksheetSelection.tableId;
  const governanceRowBySource = new Map<string, z.infer<typeof f3GovernanceRowSchema>>();
  worksheet.governanceRows.forEach((row, rowIndex) => {
    if (row.source.worksheetName !== worksheet.worksheetName || row.source.tableId !== tableId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance source must match calculation worksheet and table", path: ["governanceRows", rowIndex, "source"] });
    }
    if (row.imageReference.worksheetName !== worksheet.imageReference.worksheetName) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance image worksheetName must match the worksheet image", path: ["governanceRows", rowIndex, "imageReference", "worksheetName"] });
    }
    if (row.imageReference.relativePath !== worksheet.imageReference.relativePath) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance image relativePath must match the worksheet image", path: ["governanceRows", rowIndex, "imageReference", "relativePath"] });
    }
    if (row.imageReference.contentHash !== worksheet.imageReference.contentHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance image contentHash must match the worksheet image", path: ["governanceRows", rowIndex, "imageReference", "contentHash"] });
    }
    const key = sourceKey(row.source);
    if (governanceRowBySource.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance source key must be unique", path: ["governanceRows", rowIndex, "source"] });
    } else {
      governanceRowBySource.set(key, row);
    }
  });
  if (worksheet.observationVersion === "f5-image-observation-v2" && worksheet.contextSnapshot !== undefined) {
    const snapshotRowKeys = validateF5ContextSnapshotGovernanceRows(
      worksheet.contextSnapshot,
      worksheet.governanceRows,
      context,
    );
    worksheet.statements.forEach((statement, statementIndex) => {
      if (statement.type !== "SIGNAL" || !("signalKind" in statement.content)
        || statement.content.signalKind !== "image_text_context_review") return;
      validateF5ContextualSignalLinks(
        statement.content.scope,
        statement.content,
        snapshotRowKeys,
        context,
        ["statements", statementIndex, "content"],
      );
      const imageReference = statement.content.visualEvidence.imageReference;
      if (imageReference.worksheetName !== worksheet.imageReference.worksheetName
        || imageReference.relativePath !== worksheet.imageReference.relativePath
        || imageReference.contentHash !== worksheet.imageReference.contentHash) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "context SIGNAL image must match the worksheet image",
          path: ["statements", statementIndex, "content", "visualEvidence", "imageReference"],
        });
      }
    });
  }
  const factorSourceKeys = new Set<string>();
  worksheet.calculationResult.factors.forEach((factor, factorIndex) => {
    const key = sourceKey(factor.source);
    if (factorSourceKeys.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor source key must be unique", path: ["calculationResult", "factors", factorIndex, "source"] });
    } else {
      factorSourceKeys.add(key);
    }
    if (!governanceRowBySource.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor source must match a governance row", path: ["calculationResult", "factors", factorIndex, "source"] });
    }
  });
  worksheet.governanceRows.forEach((row, rowIndex) => {
    if (!factorSourceKeys.has(sourceKey(row.source))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance source must match a calculation factor", path: ["governanceRows", rowIndex, "source"] });
    }
  });
  const factStatementIds = new Set(worksheet.statements.filter(({ type }) => type === "FACT").map(({ statementId }) => statementId));
  const rejectedImageFactIds = new Set(worksheet.statements.filter((statement) => (
    statement.type === "FACT" && statement.content.provenanceKind === "image_observation"
      && statement.content.reviewStatus === "rejected"
  )).map(({ statementId }) => statementId));
  const statementById = new Map(worksheet.statements.map((statement) => [statement.statementId, statement]));
  const clarificationById = new Map(worksheet.clarifications.map((clarification) => [clarification.clarificationId, clarification]));
  worksheet.statements.forEach((statement, statementIndex) => {
    if (statement.type === "FACT" && statement.content.provenanceKind === "image_observation") {
      const imageReference = statement.content.imageReference;
      if (imageReference.worksheetName !== worksheet.worksheetName
        || imageReference.relativePath !== worksheet.imageReference.relativePath
        || imageReference.contentHash !== worksheet.imageReference.contentHash) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "FACT image must match the worksheet image", path: ["statements", statementIndex, "content", "imageReference"] });
      }
    }
    if (statement.type === "SIGNAL" && "triggerFactReferences" in statement.content) {
      statement.content.triggerFactReferences?.forEach((reference, referenceIndex) => {
        if (!factStatementIds.has(reference)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "trigger reference must identify a FACT in the same worksheet", path: ["statements", statementIndex, "content", "triggerFactReferences", referenceIndex] });
        }
        if (rejectedImageFactIds.has(reference)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "SIGNAL must not reference a rejected image FACT", path: ["statements", statementIndex, "content", "triggerFactReferences", referenceIndex] });
        }
      });
    }
  });
  const governanceFacts = worksheet.statements.map((statement, statementIndex) => ({ statement, statementIndex })).filter(({ statement }) => (
    statement.type === "FACT" && statement.content.provenanceKind === "f3_governance"
  ));
  const governanceFactBySource = new Map<string, (typeof governanceFacts)[number]>();
  governanceFacts.forEach((governanceFact) => {
    if (governanceFact.statement.type !== "FACT" || governanceFact.statement.content.provenanceKind !== "f3_governance") return;
    const key = sourceKey(governanceFact.statement.content.source);
    if (governanceFactBySource.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance FACT source must be unique", path: ["statements", governanceFact.statementIndex, "content", "source"] });
    } else {
      governanceFactBySource.set(key, governanceFact);
    }
    const row = governanceRowBySource.get(key);
    if (row === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance FACT must match an F3 governance row", path: ["statements", governanceFact.statementIndex, "content", "source"] });
      return;
    }
    for (const field of ["drawingNumber", "dimId", "dimIdStatus", "governanceStatus"] as const) {
      if (governanceFact.statement.content[field] !== row[field]) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `governance FACT ${field} must match the F3 governance row`, path: ["statements", governanceFact.statementIndex, "content", field] });
      }
    }
    if (JSON.stringify(governanceFact.statement.content.qualitySignals) !== JSON.stringify(row.qualitySignals)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "governance FACT qualitySignals must match the F3 governance row", path: ["statements", governanceFact.statementIndex, "content", "qualitySignals"] });
    }
  });
  worksheet.governanceRows.forEach((row, rowIndex) => {
    if (!governanceFactBySource.has(sourceKey(row.source))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "F3 governance row requires a matching governance FACT", path: ["governanceRows", rowIndex] });
    }
  });
  worksheet.statements.forEach((statement, statementIndex) => {
    if (statement.type !== "SIGNAL" || !("signalKind" in statement.content)
      || statement.content.signalKind !== "identifier_governance_gap") return;
    statement.content.triggerFactReferences.forEach((reference, referenceIndex) => {
      const trigger = statementById.get(reference);
      if (trigger?.type !== "FACT" || trigger.content.provenanceKind !== "f3_governance") {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "identifier governance SIGNAL must reference an F3 governance FACT", path: ["statements", statementIndex, "content", "triggerFactReferences", referenceIndex] });
      }
    });
  });
  const usableImageFactIds = new Set(worksheet.statements.filter((statement) => (
    statement.type === "FACT" && statement.content.provenanceKind === "image_observation"
      && statement.content.reviewStatus !== "rejected"
  )).map(({ statementId }) => statementId));
  const toleranceStatus = worksheet.sections.toleranceChainValidity.status;
  const structuralScopes = f5StructuralScopeSchema.options;
  const toleranceItems = worksheet.sections.toleranceChainValidity.items;
  toleranceItems.forEach((item, itemIndex) => {
    const itemPath: Array<string | number> = ["sections", "toleranceChainValidity", "items", itemIndex];
    if (item.scope !== structuralScopes[itemIndex]) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance scope items must be complete and in schema order", path: [...itemPath, "scope"] });
    }
    let hasSameScopeEvidence = false;
    let hasSameScopeFact = false;
    item.relatedStatementIds.forEach((statementId, referenceIndex) => {
      const statement = statementById.get(statementId);
      if (statement === undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance item statement reference must exist", path: [...itemPath, "relatedStatementIds", referenceIndex] });
        return;
      }
      if (statement.type === "FACT" && statement.content.provenanceKind === "image_observation") {
        if (statement.content.scope !== item.scope) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance image FACT scope must match item scope", path: [...itemPath, "relatedStatementIds", referenceIndex] });
        } else if (statement.content.reviewStatus !== "rejected") {
          hasSameScopeEvidence = true;
          hasSameScopeFact = true;
        }
        return;
      }
      if (statement.type === "SIGNAL" && "signalKind" in statement.content
        && statement.content.signalKind === "structural_evidence_review") {
        const triggerScopes = (statement.content.triggerFactReferences ?? []).flatMap((reference) => {
          const trigger = statementById.get(reference);
          return trigger?.type === "FACT" && trigger.content.provenanceKind === "image_observation"
            && trigger.content.reviewStatus !== "rejected" ? [trigger.content.scope] : [];
        });
        const observationScopes = (statement.content.observationEvidence ?? [])
          .filter(({ reviewStatus }) => reviewStatus !== "rejected")
          .map(({ scope }) => scope);
        const evidenceScopes = [...triggerScopes, ...observationScopes];
        if (evidenceScopes.length === 0 || evidenceScopes.some((scope) => scope !== item.scope)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance structural SIGNAL evidence scope must match item scope", path: [...itemPath, "relatedStatementIds", referenceIndex] });
        } else {
          hasSameScopeEvidence = true;
        }
        return;
      }
      if (statement.type === "SIGNAL" && "signalKind" in statement.content
        && statement.content.signalKind === "image_text_context_review") {
        if (statement.content.scope !== item.scope) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance context SIGNAL scope must match item scope", path: [...itemPath, "relatedStatementIds", referenceIndex] });
        } else {
          hasSameScopeEvidence = true;
        }
        return;
      }
      context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance item statements must be structural evidence", path: [...itemPath, "relatedStatementIds", referenceIndex] });
    });
    let hasSameScopeClarification = false;
    item.clarificationIds.forEach((clarificationId, referenceIndex) => {
      const clarification = clarificationById.get(clarificationId);
      if (clarification === undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance item clarification reference must exist", path: [...itemPath, "clarificationIds", referenceIndex] });
      } else if (clarification.section !== "toleranceChainValidity" || clarification.structuralScope !== item.scope) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance clarification scope must match item scope", path: [...itemPath, "clarificationIds", referenceIndex] });
      } else {
        hasSameScopeClarification = true;
      }
    });
    if ((item.status === "not_evaluated" || item.status === "insufficient_evidence") && !hasSameScopeClarification) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${item.status} tolerance item requires a same-scope clarification`, path: [...itemPath, "clarificationIds"] });
    }
    if (item.status === "needs_review" && !hasSameScopeEvidence) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "needs_review tolerance item requires same-scope evidence", path: [...itemPath, "relatedStatementIds"] });
    }
    if (item.status === "supported" && !hasSameScopeFact) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "supported tolerance item requires a same-scope image FACT", path: [...itemPath, "relatedStatementIds"] });
    }
    if (item.status === "not_applicable" && !hasSameScopeClarification) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "not_applicable tolerance item requires a same-scope applicability clarification", path: [...itemPath, "clarificationIds"] });
    }
  });
  const toleranceSeverity = { supported: 0, not_applicable: 0, not_evaluated: 1, insufficient_evidence: 2, needs_review: 3 } as const;
  const expectedToleranceStatus = toleranceItems.slice(1).reduce((highest, item) => (
    toleranceSeverity[item.status] > toleranceSeverity[highest] ? item.status : highest
  ), toleranceItems[0]!.status);
  if (toleranceStatus !== expectedToleranceStatus) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance status must aggregate the most severe item status", path: ["sections", "toleranceChainValidity", "status"] });
  }
  const toleranceClarifications = worksheet.clarifications.filter(({ section }) => section === "toleranceChainValidity");
  if (toleranceStatus === "not_evaluated" && toleranceClarifications.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "not_evaluated tolerance validity requires a structural evidence clarification", path: ["sections", "toleranceChainValidity", "status"] });
  }
  if ((toleranceStatus === "supported" || toleranceStatus === "needs_review") && usableImageFactIds.size === 0) {
    const hasUsableObservationEvidence = worksheet.statements.some((statement) => (
      statement.type === "SIGNAL"
      && "signalKind" in statement.content
      && (statement.content.signalKind === "image_text_context_review"
        || (statement.content.signalKind === "structural_evidence_review"
          && statement.content.observationEvidence?.some(({ reviewStatus }) => reviewStatus !== "rejected")))
    ));
    if (toleranceStatus === "supported" || !hasUsableObservationEvidence) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${toleranceStatus} tolerance validity requires usable image evidence`, path: ["sections", "toleranceChainValidity", "status"] });
    }
  }
  if (toleranceStatus === "needs_review") {
    const structuralSignals = worksheet.statements.map((statement, statementIndex) => ({ statement, statementIndex })).filter(({ statement }) => (
      statement.type === "SIGNAL"
      && "signalKind" in statement.content
      && (statement.content.signalKind === "structural_evidence_review"
        || statement.content.signalKind === "image_text_context_review")
    ));
    if (structuralSignals.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "needs_review tolerance validity requires a structural review SIGNAL", path: ["sections", "toleranceChainValidity", "status"] });
    }
    structuralSignals.forEach(({ statement, statementIndex }) => {
      if (statement.type !== "SIGNAL" || !("signalKind" in statement.content)
        || statement.content.signalKind !== "structural_evidence_review") return;
      statement.content.triggerFactReferences?.forEach((reference, referenceIndex) => {
        if (!usableImageFactIds.has(reference)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "structural review SIGNAL must reference an image FACT", path: ["statements", statementIndex, "content", "triggerFactReferences", referenceIndex] });
        }
      });
      statement.content.observationEvidence?.forEach((evidence, evidenceIndex) => {
        if (evidence.reviewStatus === "rejected") {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "rejected observation evidence must not support a SIGNAL", path: ["statements", statementIndex, "content", "observationEvidence", evidenceIndex, "reviewStatus"] });
        }
        if (evidence.imageReference.worksheetName !== worksheet.imageReference.worksheetName
          || evidence.imageReference.relativePath !== worksheet.imageReference.relativePath
          || evidence.imageReference.contentHash !== worksheet.imageReference.contentHash) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "SIGNAL observation image must match the worksheet image", path: ["statements", statementIndex, "content", "observationEvidence", evidenceIndex, "imageReference"] });
        }
      });
    });
  }
  const capabilitySectionStatementIds = worksheet.sections.capabilityVsSpecification.statementIds;
  capabilitySectionStatementIds.forEach((statementId, statementIdIndex) => {
    const statement = statementById.get(statementId);
    if (statement === undefined
      || (statement.type !== "FACT" && statement.type !== "RULE")
      || (statement.section !== "capability-vs-specification" && statement.section !== "calculation-summary")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "supported capability statements must reference capability or calculation-summary FACT/RULE evidence",
        path: ["sections", "capabilityVsSpecification", "statementIds", statementIdIndex],
      });
    }
  });
  const capabilityMetrics = [
    "cp",
    "cpk",
    "rss_sigma",
    "total_dpm",
    "yield",
    "lower_spec_limit",
    "upper_spec_limit",
    "target_cpk",
    "target_sigma",
    "recommended_method",
    "achieved_sigma",
  ] as const;
  const capabilityMetricSet = new Set<string>(capabilityMetrics);
  const capabilityFacts = worksheet.statements.filter((statement) => (
    statement.type === "FACT" && statement.content.provenanceKind !== "image_observation"
      && "metric" in statement.content && capabilityMetricSet.has(statement.content.metric)
  ));
  const capabilityRules = worksheet.statements.filter((statement) => (
    statement.type === "RULE" && statement.section === "capability-vs-specification"
  ));
  const expectedCapabilityStatementIds = new Set([
    ...capabilityFacts.map(({ statementId }) => statementId),
    ...capabilityRules.map(({ statementId }) => statementId),
  ]);
  if (new Set(capabilitySectionStatementIds).size !== capabilitySectionStatementIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "capability statementIds must be unique", path: ["sections", "capabilityVsSpecification", "statementIds"] });
  }
  if (capabilitySectionStatementIds.length !== expectedCapabilityStatementIds.size
    || capabilitySectionStatementIds.some((statementId) => !expectedCapabilityStatementIds.has(statementId))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "capability statementIds must exactly cover required FACT and applicable RULE evidence", path: ["sections", "capabilityVsSpecification", "statementIds"] });
  }
  for (const metric of capabilityMetrics) {
    const matchingFacts = capabilityFacts.filter((statement) => (
      statement.type === "FACT" && statement.content.provenanceKind !== "image_observation"
        && "metric" in statement.content && statement.content.metric === metric
    ));
    if (matchingFacts.length !== 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `capability requires exactly one ${metric} FACT`, path: ["sections", "capabilityVsSpecification", "statementIds"] });
      continue;
    }
    const fact = matchingFacts[0]!;
    if (fact.type !== "FACT" || fact.content.provenanceKind === "image_observation" || !("metric" in fact.content)) continue;
    const factIndex = worksheet.statements.findIndex(({ statementId }) => statementId === fact.statementId);
    const factPath: Array<string | number> = ["statements", factIndex, "content"];
    const formulaExpectations: Partial<Record<typeof metric, { value: number; outputField: string }>> = {
      cp: { value: worksheet.calculationResult.capability.cp, outputField: "capability.cp" },
      cpk: { value: worksheet.calculationResult.capability.cpk, outputField: "capability.cpk" },
      rss_sigma: { value: worksheet.calculationResult.system.rssSigma, outputField: "system.rssSigma" },
      total_dpm: { value: worksheet.calculationResult.capability.totalDpm, outputField: "capability.totalDpm" },
      yield: { value: worksheet.calculationResult.capability.yield, outputField: "capability.yield" },
    };
    const formulaExpectation = formulaExpectations[metric];
    if (formulaExpectation !== undefined) {
      const content = fact.content as z.infer<typeof interpretationFormulaNumericFactContentSchema>;
      const expectedTrace = worksheet.calculationResult.traceRecords.filter(({ outputField }) => outputField === formulaExpectation.outputField);
      if (content.provenanceKind !== "formula_output"
        || !nearlyEqual(content.value, formulaExpectation.value)
        || content.outputField !== formulaExpectation.outputField
        || JSON.stringify(content.traceRecords) !== JSON.stringify(expectedTrace)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${metric} FACT must match the F4 formula output and trace`, path: factPath });
      }
      continue;
    }
    const inputExpectations: Partial<Record<typeof metric, { value: number; inputField: string }>> = {
      lower_spec_limit: { value: worksheet.calculationResult.capability.lowerSpecLimit, inputField: "capability.lowerSpecLimit" },
      upper_spec_limit: { value: worksheet.calculationResult.capability.upperSpecLimit, inputField: "capability.upperSpecLimit" },
      target_cpk: { value: worksheet.calculationResult.capability.targetCpk, inputField: "capability.targetCpk" },
      target_sigma: { value: worksheet.calculationResult.capability.targetSigmaLevel, inputField: "capability.targetSigmaLevel" },
    };
    const inputExpectation = inputExpectations[metric];
    if (inputExpectation !== undefined) {
      const content = fact.content as z.infer<typeof interpretationCalculationInputNumericFactContentSchema>;
      if (content.provenanceKind !== "calculation_input"
        || !nearlyEqual(content.value, inputExpectation.value)
        || content.inputField !== inputExpectation.inputField) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${metric} FACT must match the F4 calculation input`, path: factPath });
      }
      continue;
    }
    if (metric === "recommended_method") {
      const content = fact.content as z.infer<typeof interpretationRecommendedMethodCalculationInputFactContentSchema>;
      const recommendation = worksheet.calculationResult.recommendation;
      if (content.provenanceKind !== "calculation_input"
        || content.inputField !== "recommendation.method"
        || content.method !== recommendation.method
        || content.reason !== recommendation.reason
        || content.refer3d !== recommendation.refer3d
        || content.criticality !== recommendation.criticality
        || content.criticalityRisk !== recommendation.criticalityRisk) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "recommended_method FACT must match the F4 recommendation", path: factPath });
      }
      continue;
    }
    const content = fact.content as z.infer<typeof interpretationDerivedAchievedSigmaFactContentSchema>;
    const expectedOutputFields = ["capability.lowerZ", "capability.upperZ"];
    const expectedTrace = expectedOutputFields.flatMap((outputField) => (
      worksheet.calculationResult.traceRecords.filter((trace) => trace.outputField === outputField)
    ));
    if (content.provenanceKind !== "derived_from_formula_outputs"
      || !nearlyEqual(content.value, Math.min(
        worksheet.calculationResult.capability.lowerZ,
        worksheet.calculationResult.capability.upperZ,
      ))
      || JSON.stringify(content.sourceOutputFields) !== JSON.stringify(expectedOutputFields)
      || JSON.stringify(content.traceRecords) !== JSON.stringify(expectedTrace)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "achieved_sigma FACT must match the F4 derived outputs and traces", path: factPath });
    }
  }

  const contributionFacts: Array<{
    statementId: string;
    content: z.infer<typeof interpretationFactorContributionFactContentSchema>;
  }> = [];
  worksheet.statements.forEach((statement) => {
    if (statement.type === "FACT" && statement.content.provenanceKind !== "image_observation"
      && "metric" in statement.content
      && statement.content.metric === "factor_contribution") {
      contributionFacts.push({ statementId: statement.statementId, content: statement.content });
    }
  });
  const contributorItems = worksheet.sections.majorContributors.items;
  const factors = worksheet.calculationResult.factors;
  if (contributorItems.length !== factors.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "each F4 factor must have exactly one contributor item", path: ["sections", "majorContributors", "items"] });
  }
  const itemFactorReferences = contributorItems.map(({ factorReference }) => factorReference);
  if (new Set(itemFactorReferences).size !== itemFactorReferences.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor factorReference must be unique", path: ["sections", "majorContributors", "items"] });
  }
  const itemFactorIndexes = contributorItems.map(({ factorIndex }) => factorIndex);
  if (new Set(itemFactorIndexes).size !== itemFactorIndexes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor factorIndex must be unique", path: ["sections", "majorContributors", "items"] });
  }
  contributorItems.forEach((item, itemIndex) => {
    const itemPath: Array<string | number> = ["sections", "majorContributors", "items", itemIndex];
    const factor = factors[item.factorIndex];
    if (factor === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor factorIndex must identify an F4 factor", path: [...itemPath, "factorIndex"] });
    } else {
      const expectedFactorReference = `${factor.source.worksheetName}/${factor.source.tableId}/${factor.source.sourceRow}`;
      if (item.factorName !== factor.factorName) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor factorName must match the F4 factor", path: [...itemPath, "factorName"] });
      }
      if (item.source.worksheetName !== factor.source.worksheetName
        || item.source.tableId !== factor.source.tableId
        || item.source.sourceRow !== factor.source.sourceRow) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor source must match the F4 factor", path: [...itemPath, "source"] });
      }
      if (item.factorReference !== expectedFactorReference) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor factorReference must match the F4 factor", path: [...itemPath, "factorReference"] });
      }
      if (!nearlyEqual(item.contributionPercent, factor.contribution * 100)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor percentage must match the F4 factor", path: [...itemPath, "contributionPercent"] });
      }
      for (const field of ["halfTolerance", "sigma", "unit"] as const) {
        if (item[field] !== factor[field]) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: `contributor ${field} must match the F4 factor`, path: [...itemPath, field] });
        }
      }
    }
    const governanceRow = governanceRowBySource.get(sourceKey(item.source));
    if (governanceRow !== undefined) {
      if (item.drawingNumber !== governanceRow.drawingNumber) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor drawingNumber must match the F3 governance row", path: [...itemPath, "drawingNumber"] });
      }
      if (item.dimId !== governanceRow.dimId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor dimId must match the F3 governance row", path: [...itemPath, "dimId"] });
      }
      if (item.governanceStatus !== governanceRow.governanceStatus) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor governanceStatus must match the F3 governance row", path: [...itemPath, "governanceStatus"] });
      }
    }
    const contributionFact = contributionFacts.find((statement) => statement.content.factorReference === item.factorReference);
    if (contributionFact === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor must match an F4 factor FACT", path: [...itemPath, "factorReference"] });
    } else {
      const factorIndexMatch = /^factors\[(\d+)\]\.contribution$/.exec(contributionFact.content.outputField);
      const expectedFactorIndex = factorIndexMatch === null ? -1 : Number(factorIndexMatch[1]);
      if (item.factorIndex !== expectedFactorIndex) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor factorIndex must match the F4 factor", path: [...itemPath, "factorIndex"] });
      }
      if (item.contributionPercent !== contributionFact.content.contributionPercent) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor percentage must match the F4 factor FACT", path: [...itemPath, "contributionPercent"] });
      }
      if (!item.relatedStatementIds.includes(contributionFact.statementId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributor must reference its factor contribution FACT", path: [...itemPath, "relatedStatementIds"] });
      }
    }
    item.relatedStatementIds.forEach((statementId, relatedIndex) => {
      if (!statementById.has(statementId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "related contributor statement must exist", path: [...itemPath, "relatedStatementIds", relatedIndex] });
      }
    });
    const relatedStatements = item.relatedStatementIds.map((statementId) => statementById.get(statementId));
    if (item.reasonCodes.includes("contribution_concentration") && !relatedStatements.some((statement) => (
      statement?.type === "SIGNAL" && "entryId" in statement.content
        && statement.content.entryId === "root-cause-contributor-concentration"
    ))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "contribution concentration reason requires its F0 SIGNAL", path: [...itemPath, "reasonCodes"] });
    }
    if (item.reasonCodes.includes("identifier_governance_gap") && !relatedStatements.some((statement) => (
      statement?.type === "SIGNAL" && "signalKind" in statement.content
        && statement.content.signalKind === "identifier_governance_gap"
    ))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "identifier governance reason requires its governance SIGNAL", path: [...itemPath, "reasonCodes"] });
    }
    if (itemIndex > 0) {
      const previous = contributorItems[itemIndex - 1]!;
      if (item.contributionPercent > previous.contributionPercent
        || (item.contributionPercent === previous.contributionPercent && item.factorIndex <= previous.factorIndex)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "contributors must be ordered by contribution and F4 factor index", path: itemPath });
      }
    }
  });
  const clarificationIds = worksheet.clarifications.map(({ clarificationId }) => clarificationId);
  if (new Set(clarificationIds).size !== clarificationIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "clarificationId must be unique", path: ["clarifications"] });
  }
  const assumptionIds = worksheet.assumptions.map(({ assumptionId }) => assumptionId);
  if (new Set(assumptionIds).size !== assumptionIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "assumptionId must be unique", path: ["assumptions"] });
  }
});

const f5InputRejectedWorksheetResultSchema = z.object({
  worksheetName: z.string().min(1),
  status: z.literal("input_rejected"),
  reasonCode: z.enum([
    "artifact_missing",
    "artifact_identity_mismatch",
    "artifact_contract_invalid",
    "interpretation_failed",
  ]),
  artifactReference: z.string().refine((reference) => {
    const worksheetReference = reference.slice("worksheet:".length);
    return reference.startsWith("worksheet:")
      && worksheetReference.length > 0
      && !/[\\/]/.test(worksheetReference)
      && [...worksheetReference].every((character) => {
        const codePoint = character.codePointAt(0)!;
        return codePoint >= 32 && codePoint !== 127;
      });
  }),
}).strict().superRefine((worksheet, context) => {
  if (worksheet.artifactReference !== `worksheet:${worksheet.worksheetName}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "artifactReference must identify the rejected worksheet", path: ["artifactReference"] });
  }
});

const f5WorksheetResultSchema = z.union([
  f5CompletedWorksheetResultSchema,
  f5InputRejectedWorksheetResultSchema,
]);

export const f5DataInterpretationResultSchema = z.object({
  contractVersion: contractVersionSchema,
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F5"),
  status: z.enum(["completed", "partially_completed", "input_rejected"]),
  interpretationVersion: z.literal("f5-data-interpretation-v1"),
  knowledgeBaseVersion: z.literal("interpretation-rules-v1"),
  workbook: z.object({ fileName: workbookCatalogFileNameSchema, contentHash: sha256Schema }).strict(),
  worksheets: z.array(f5WorksheetResultSchema).min(1),
  summary: z.object({
    worksheetCount: z.number().int().positive(),
    completedWorksheetCount: z.number().int().nonnegative(),
    inputRejectedWorksheetCount: z.number().int().nonnegative(),
    statementCount: z.number().int().nonnegative(),
    clarificationCount: z.number().int().nonnegative(),
    assumptionCount: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((result, context) => {
  const worksheetNames = result.worksheets.map(({ worksheetName }) => worksheetName);
  if (new Set(worksheetNames).size !== worksheetNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique", path: ["worksheets"] });
  }

  const completedWorksheets = result.worksheets.filter((worksheet) => worksheet.status === "completed");
  const completedWorksheetCount = completedWorksheets.length;
  const inputRejectedWorksheetCount = result.worksheets.length - completedWorksheetCount;
  const expectedStatus = inputRejectedWorksheetCount === 0
    ? "completed"
    : completedWorksheetCount === 0
      ? "input_rejected"
      : "partially_completed";
  if (result.status !== expectedStatus) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "overall status must match worksheet statuses", path: ["status"] });
  }

  const expectedSummary = {
    worksheetCount: result.worksheets.length,
    completedWorksheetCount,
    inputRejectedWorksheetCount,
    statementCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.statements.length, 0),
    clarificationCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.clarifications.length, 0),
    assumptionCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.assumptions.length, 0),
  };
  for (const [field, expectedValue] of Object.entries(expectedSummary)) {
    if (result.summary[field as keyof typeof expectedSummary] !== expectedValue) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must match worksheet records`, path: ["summary", field] });
    }
  }
  result.worksheets.forEach((worksheet, worksheetIndex) => {
    if (worksheet.status === "completed" && worksheet.calculationResult.workbookContentHash !== result.workbook.contentHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "calculation workbook hash must match result workbook", path: ["worksheets", worksheetIndex, "calculationResult", "workbookContentHash"] });
    }
  });
});

const drawingGovernanceAcceptedResultV2Schema = z.object({
  contractVersion: contractVersionSchema,
  modelVersion: z.literal("drawing-governance-v2"),
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F3"),
  status: z.enum(["completed", "governance_required"]),
  artifactRoot: z.string().min(1),
  workbook: z.object({ fileName: z.string().min(1), contentHash: sha256Schema }).strict(),
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    toleranceLoopDescription: z.string().min(1),
    rows: z.array(f3GovernanceRowSchema),
  }).strict().superRefine((worksheet, context) => {
    worksheet.rows.forEach((row, index) => {
      if (row.imageReference.worksheetName !== worksheet.worksheetName) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "image reference worksheet must match the containing worksheet", path: ["rows", index, "imageReference", "worksheetName"] });
      }
    });
  })),
  ado: z.object({
    status: z.enum([
      "not_requested",
      "draft_ready",
      "confirmation_required",
      "updated",
      "blocked",
      "failed",
    ]),
    workItemReference: z.string().min(1).optional(),
    reasonCode: z.string().min(1).optional(),
  }).strict(),
  summary: z.object({
    worksheetCount: z.number().int().nonnegative(),
    factorCount: z.number().int().nonnegative(),
    completeCount: z.number().int().nonnegative(),
    governanceRequiredCount: z.number().int().nonnegative(),
    duplicateConflictCount: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((result, context) => {
  const rows = result.worksheets.flatMap((worksheet) => worksheet.rows);
  const completeCount = rows.filter((row) => row.governanceStatus === "complete").length;
  const expectedSummary = {
    worksheetCount: result.worksheets.length,
    factorCount: rows.length,
    completeCount,
    governanceRequiredCount: rows.length - completeCount,
    duplicateConflictCount: rows.filter((row) => row.qualitySignals.includes("duplicate_conflict")).length,
  };

  for (const [field, value] of Object.entries(expectedSummary)) {
    if (result.summary[field as keyof typeof expectedSummary] !== value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field} must match governance records`,
        path: ["summary", field],
      });
    }
  }

  const expectedStatus = expectedSummary.governanceRequiredCount === 0
    ? "completed"
    : "governance_required";
  if (result.status !== expectedStatus) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "status must match governance records",
      path: ["status"],
    });
  }
});

const drawingGovernanceInputRejectedResultV2Schema = z.object({
  contractVersion: contractVersionSchema,
  modelVersion: z.literal("drawing-governance-v2"),
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F3"),
  status: z.literal("input_rejected"),
  artifactIssues: z.array(z.object({
    reasonCode: z.enum([
      "f2_report_missing",
      "f2_report_invalid",
      "workbook_identity_mismatch",
      "description_missing",
      "no_ready_worksheet",
      "worksheet_selection_invalid",
    ]),
    artifactReference: z.string().min(1),
  }).strict()).min(1),
}).strict();

export const drawingGovernanceResultV2Schema = z.union([
  drawingGovernanceInputRejectedResultV2Schema,
  drawingGovernanceAcceptedResultV2Schema,
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
export type InterpretationFactReference = z.infer<typeof interpretationFactReferenceSchema>;
export type InterpretationRuleEvaluationRequest = z.infer<typeof interpretationRuleEvaluationRequestSchema>;
export type InterpretationRuleEvaluation = z.infer<typeof interpretationRuleEvaluationSchema>;
export type WorkbookCatalogRequest = z.infer<typeof workbookCatalogRequestSchema>;
export type WorkbookCatalogResult = z.infer<typeof workbookCatalogResultSchema>;
export type WorksheetSelectionViewRequest = z.infer<typeof worksheetSelectionViewRequestSchema>;
export type WorksheetSelectionViewResult = z.infer<typeof worksheetSelectionViewResultSchema>;
export type WorksheetSelectionPrompt = z.infer<typeof worksheetSelectionPromptSchema>;
export type WorksheetSelectionConfirmation = z.infer<typeof worksheetSelectionConfirmationSchema>;
export type WorksheetSelectionConfirmationResult = z.infer<typeof worksheetSelectionConfirmationResultSchema>;
export type WorksheetSystemSpecification = z.infer<typeof worksheetSystemSpecificationSchema>;
export type WorksheetAnalysisAssetsRequest = z.infer<typeof worksheetAnalysisAssetsRequestSchema>;
export type WorksheetAnalysisAssetsResult = z.infer<typeof worksheetAnalysisAssetsResultSchema>;
export type F2InitialWorkflowRequest = z.infer<typeof f2InitialWorkflowRequestSchema>;
export type F2InitialWorkflowResult = z.infer<typeof f2InitialWorkflowResultSchema>;
export type F2ArtifactInput = z.infer<typeof f2ArtifactInputSchema>;
export type F2UserReport = z.infer<typeof f2UserReportSchema>;
export type F2SystemSpecificationIssue = z.infer<typeof f2SystemSpecificationIssueSchema>;
export type F2ReadyWorksheet = z.infer<typeof f2ReadyWorksheetSchema>;
export type F4HandoffReady = z.infer<typeof f4HandoffReadySchema>;
export type DrawingGovernanceRequestV2 = z.infer<typeof drawingGovernanceRequestV2Schema>;
export type DrawingGovernanceResultV2 = z.infer<typeof drawingGovernanceResultV2Schema>;
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
const f6RelativeArtifactPathSchema = z.string().min(1).max(500).superRefine((value, context) => {
  if (/^(?:[A-Za-z]:|[\\/])/.test(value) || value.includes("\\")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "artifact references must be relative POSIX paths" });
  }
  if (value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "artifact references must not contain empty or traversal segments" });
  }
});

const f6ArtifactReferenceSchema = z.object({
  artifact: f6RelativeArtifactPathSchema,
  contentHash: sha256Schema,
}).strict();

export const f6FactorIdentitySchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  factorName: z.string().min(1),
  unit: z.string().min(1),
}).strict();

export const f6InputBaselineIdentitySchema = z.object({
  calculationVersion: z.literal("excel-ta-v1"),
  projectReference: z.string().min(1),
  runReference: z.string().min(1),
  workbookContentHash: sha256Schema,
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
}).strict();

const f6V2FormulaReferenceSchema = z.object({
  outputField: z.string().min(1),
  formulaId: z.string().min(1),
  formulaVersion: z.string().min(1),
}).strict();

const f6EvidenceLocatorSchema = z.object({
  artifactReference: f6ArtifactReferenceSchema,
  worksheetName: z.string().min(1),
  sourceRows: z.array(z.object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
  }).strict()).min(1),
}).strict();

const f6FactorToleranceTargetSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.literal("factor_tolerance"),
  factor: f6FactorIdentitySchema,
  upperTolerance: z.number().finite(),
  lowerTolerance: z.number().finite(),
  unit: z.string().min(1),
}).strict();

const f6FactorSigmaTargetSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.literal("factor_sigma"),
  factor: f6FactorIdentitySchema,
  sigma: z.number().finite().positive(),
  unit: z.string().min(1),
}).strict();

const f6ImprovementRatioTargetSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.literal("improvement_ratio"),
  factor: f6FactorIdentitySchema,
  ratio: z.number().finite().gt(0).lt(1),
  appliesTo: z.enum(["tolerance_band", "sigma"]),
}).strict();

const f6SystemTargetSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.literal("system_target"),
  systemIdentity: z.object({
    baselineIdentity: f6InputBaselineIdentitySchema,
    designNominal: z.number().finite(),
    mean: z.number().finite(),
    rssSigma: z.number().finite().nonnegative(),
    lowerSpecLimit: z.number().finite(),
    upperSpecLimit: z.number().finite(),
    targetCpk: z.number().finite().positive(),
    traceReferences: z.array(f6V2FormulaReferenceSchema),
  }).strict().superRefine((identity, context) => {
    if (!(identity.upperSpecLimit > identity.lowerSpecLimit)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "upperSpecLimit must be greater than lowerSpecLimit", path: ["upperSpecLimit"] });
    }
  }),
  target: z.union([
    z.object({ targetCpk: z.number().finite().positive() }).strict(),
    z.object({ targetRssSigma: z.number().finite().positive(), unit: z.string().min(1) }).strict(),
  ]),
  apportionment: z.object({
    policy: z.enum(["PROPORTIONAL", "EQUAL_SELECTED", "CAPABILITY_BOUNDED"]),
    selectedFactors: z.array(f6FactorIdentitySchema).min(1),
  }).strict(),
}).strict();

const f6OptimizationTargetSchema = z.discriminatedUnion("targetType", [
  f6FactorToleranceTargetSchema,
  f6FactorSigmaTargetSchema,
  f6ImprovementRatioTargetSchema,
  f6SystemTargetSchema,
]);

const sameF6BaselineIdentity = (
  identity: z.infer<typeof f6InputBaselineIdentitySchema>,
  workbookContentHash: string,
  worksheetName: string,
  tableId: string,
): boolean => identity.workbookContentHash === workbookContentHash
  && identity.worksheetName === worksheetName
  && identity.tableId === tableId;

const factorBelongsToF6Worksheet = (
  factor: z.infer<typeof f6FactorIdentitySchema>,
  worksheetName: string,
  tableId: string,
): boolean => factor.worksheetName === worksheetName && factor.tableId === tableId;

export const f6OptimizationTargetsSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  targetVersion: z.literal("f6-optimization-targets-v1"),
  workbookContentHash: sha256Schema,
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    baselineIdentity: f6InputBaselineIdentitySchema,
    targets: z.array(f6OptimizationTargetSchema).min(1),
  }).strict()).min(1),
}).strict().superRefine((artifact, context) => {
  const worksheetKeys = new Set<string>();
  const targetIds = new Set<string>();
  const factorTargetKeys = new Set<string>();
  artifact.worksheets.forEach((worksheet, worksheetIndex) => {
    const worksheetKey = `${worksheet.worksheetName}\u0000${worksheet.tableId}`;
    if (worksheetKeys.has(worksheetKey)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet and table identities must be unique", path: ["worksheets", worksheetIndex] });
    }
    worksheetKeys.add(worksheetKey);
    if (!sameF6BaselineIdentity(worksheet.baselineIdentity, artifact.workbookContentHash, worksheet.worksheetName, worksheet.tableId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline identity must match the containing workbook and worksheet", path: ["worksheets", worksheetIndex, "baselineIdentity"] });
    }
    worksheet.targets.forEach((target, targetIndex) => {
      const targetPath = ["worksheets", worksheetIndex, "targets", targetIndex] as const;
      if (targetIds.has(target.targetId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "target IDs must be unique", path: [...targetPath, "targetId"] });
      }
      targetIds.add(target.targetId);
      if (target.targetType === "system_target") {
        if (!sameF6BaselineIdentity(target.systemIdentity.baselineIdentity, artifact.workbookContentHash, worksheet.worksheetName, worksheet.tableId)
          || JSON.stringify(target.systemIdentity.baselineIdentity) !== JSON.stringify(worksheet.baselineIdentity)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "system target baseline identity must match the containing worksheet", path: [...targetPath, "systemIdentity", "baselineIdentity"] });
        }
        target.apportionment.selectedFactors.forEach((factor, factorIndex) => {
          if (!factorBelongsToF6Worksheet(factor, worksheet.worksheetName, worksheet.tableId)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "selected factors must belong to the containing worksheet", path: [...targetPath, "apportionment", "selectedFactors", factorIndex] });
          }
        });
        return;
      }
      if (!factorBelongsToF6Worksheet(target.factor, worksheet.worksheetName, worksheet.tableId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "target factor must belong to the containing worksheet", path: [...targetPath, "factor"] });
      }
      if (target.targetType === "factor_tolerance") {
        if (!(target.upperTolerance > target.lowerTolerance)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "upperTolerance must be greater than lowerTolerance", path: [...targetPath, "upperTolerance"] });
        }
        if (target.unit !== target.factor.unit) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "target unit must match factor unit", path: [...targetPath, "unit"] });
        }
      }
      if (target.targetType === "factor_sigma" && target.unit !== target.factor.unit) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "target unit must match factor unit", path: [...targetPath, "unit"] });
      }
      const factorTargetKey = `${worksheetKey}\u0000${target.factor.sourceRow}\u0000${target.targetType}`;
      if (factorTargetKeys.has(factorTargetKey)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "a factor may have only one target of each type", path: targetPath as unknown as Array<string | number> });
      }
      factorTargetKeys.add(factorTargetKey);
    });
  });
});

const f6AnalysisObjectSchema = z.object({
  kind: z.enum(["GAP", "STEP", "INTERFERENCE", "ALIGNMENT", "POSITION", "CLEARANCE", "COMPRESSION", "ENGAGEMENT", "FUNCTIONAL_DIMENSION"]),
  name: z.string().min(1),
  physicalMeaning: z.string().min(1),
  measurementDirection: z.string().min(1),
  positiveDirectionDefinition: z.string().min(1),
  negativeDirectionDefinition: z.string().min(1),
  evidence: f6EvidenceLocatorSchema,
}).strict();

const f6OperatingConditionSchema = z.object({
  conditionId: z.string().min(1),
  category: z.enum(["ASSEMBLY", "LOAD", "TEMPERATURE", "STATIC_DYNAMIC", "USE", "IMPACT", "TEST", "FEA", "MATERIAL_CONSTRAINT"]),
  description: z.string().min(1),
  evidence: f6EvidenceLocatorSchema,
}).strict();

const f6CorrelationRequirementSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("INDEPENDENT"), evidence: f6EvidenceLocatorSchema }).strict(),
  z.object({ mode: z.literal("CORRELATED"), covarianceMatrixEvidence: f6EvidenceLocatorSchema }).strict(),
  z.object({ mode: z.literal("NOT_PROVIDED") }).strict(),
]);

export const f6AnalysisContextSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  contextVersion: z.literal("f6-analysis-context-v1"),
  workbookContentHash: sha256Schema,
  projectName: z.string().min(1).optional(),
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    baselineIdentity: f6InputBaselineIdentitySchema,
    analysisObject: f6AnalysisObjectSchema.optional(),
    functionalRequirements: z.object({
      requirementIds: z.array(z.string().min(1)),
      functionalBoundary: z.string().min(1).optional(),
      passFailCriteria: z.string().min(1).optional(),
      evidence: z.array(f6EvidenceLocatorSchema).min(1),
    }).strict().optional(),
    operatingConditions: z.array(f6OperatingConditionSchema),
    correlationRequirement: f6CorrelationRequirementSchema,
    loopDefinition: z.object({
      start: z.string().min(1),
      end: z.string().min(1),
      responseDirection: z.string().min(1),
      factors: z.array(z.object({ factor: f6FactorIdentitySchema, sign: z.union([z.literal(1), z.literal(-1)]) }).strict()).min(1),
      evidence: z.array(f6EvidenceLocatorSchema).min(1),
    }).strict().optional(),
  }).strict()).min(1),
}).strict().superRefine((artifact, context) => {
  const worksheetKeys = new Set<string>();
  artifact.worksheets.forEach((worksheet, worksheetIndex) => {
    const worksheetKey = `${worksheet.worksheetName}\u0000${worksheet.tableId}`;
    if (worksheetKeys.has(worksheetKey)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet and table identities must be unique", path: ["worksheets", worksheetIndex] });
    }
    worksheetKeys.add(worksheetKey);
    if (!sameF6BaselineIdentity(worksheet.baselineIdentity, artifact.workbookContentHash, worksheet.worksheetName, worksheet.tableId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline identity must match the containing workbook and worksheet", path: ["worksheets", worksheetIndex, "baselineIdentity"] });
    }
    const validateEvidence = (evidence: z.infer<typeof f6EvidenceLocatorSchema>, path: Array<string | number>) => {
      if (evidence.worksheetName !== worksheet.worksheetName
        || evidence.sourceRows.some((row) => row.worksheetName !== worksheet.worksheetName || row.tableId !== worksheet.tableId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "evidence must bind to the containing worksheet and table", path });
      }
    };
    if (worksheet.analysisObject !== undefined) validateEvidence(worksheet.analysisObject.evidence, ["worksheets", worksheetIndex, "analysisObject", "evidence"]);
    worksheet.functionalRequirements?.evidence.forEach((evidence, evidenceIndex) => validateEvidence(evidence, ["worksheets", worksheetIndex, "functionalRequirements", "evidence", evidenceIndex]));
    worksheet.operatingConditions.forEach((condition, conditionIndex) => validateEvidence(condition.evidence, ["worksheets", worksheetIndex, "operatingConditions", conditionIndex, "evidence"]));
    if (worksheet.correlationRequirement.mode === "INDEPENDENT") validateEvidence(worksheet.correlationRequirement.evidence, ["worksheets", worksheetIndex, "correlationRequirement", "evidence"]);
    if (worksheet.correlationRequirement.mode === "CORRELATED") validateEvidence(worksheet.correlationRequirement.covarianceMatrixEvidence, ["worksheets", worksheetIndex, "correlationRequirement", "covarianceMatrixEvidence"]);
    worksheet.loopDefinition?.factors.forEach(({ factor }, factorIndex) => {
      if (!factorBelongsToF6Worksheet(factor, worksheet.worksheetName, worksheet.tableId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "loop factors must belong to the containing worksheet", path: ["worksheets", worksheetIndex, "loopDefinition", "factors", factorIndex, "factor"] });
      }
    });
    worksheet.loopDefinition?.evidence.forEach((evidence, evidenceIndex) => validateEvidence(evidence, ["worksheets", worksheetIndex, "loopDefinition", "evidence", evidenceIndex]));
  });
});

export const f6InputDecisionSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("NOT_PROVIDED") }).strict(),
  z.object({ outcome: z.enum(["CONFIRMED", "CALLER_AUTHORIZED"]), artifactReference: f6ArtifactReferenceSchema }).strict(),
  z.object({ outcome: z.literal("DECLINED"), artifactReference: f6ArtifactReferenceSchema, reasonCode: z.literal("user_declined") }).strict(),
  z.object({
    outcome: z.literal("REJECTED"),
    artifactReference: f6ArtifactReferenceSchema.optional(),
    inputReferenceHash: sha256Schema,
    reasonCode: z.enum(["schema_invalid", "identity_mismatch", "unit_mismatch", "path_invalid"]),
  }).strict(),
]);

const f6F4ReferenceSchema = f6ArtifactReferenceSchema.extend({
  runId: z.string().min(1),
  calculationVersion: z.literal("excel-ta-v1"),
}).strict();

const f6F5ReferenceSchema = f6ArtifactReferenceSchema.extend({
  interpretationVersion: z.literal("f5-data-interpretation-v1"),
}).strict();

export const f6OptionKindSchema = z.enum([
  "reduce_top_contributor_20",
  "reduce_top_3_contributors_30",
  "mean_shift_centering",
  "reverse_solve_single_factor",
  "reverse_solve_top_3",
  "rss_apportionment",
  "centering_plus_tighten",
  "improve_supplier_capability",
  "tighten_datum_strategy",
  "requirement_change",
]);

export const f6MetricsSchema = z.object({
  mean: z.number().finite(),
  rssSigma: z.number().finite().nonnegative(),
  cp: z.number().finite(),
  cpk: z.number().finite(),
  yield: z.number().finite().min(0).max(1),
  dpm: z.number().finite().nonnegative(),
}).strict();

export const f6ToleranceChangeSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  originalLowerTolerance: z.number().finite(),
  originalUpperTolerance: z.number().finite(),
  resultingLowerTolerance: z.number().finite(),
  resultingUpperTolerance: z.number().finite(),
  originalBand: z.number().finite().nonnegative(),
  resultingBand: z.number().finite().nonnegative(),
  bandCenter: z.number().finite(),
}).strict().superRefine((change, context) => {
  const originalBand = change.originalUpperTolerance - change.originalLowerTolerance;
  const resultingBand = change.resultingUpperTolerance - change.resultingLowerTolerance;
  const originalCenter = (change.originalUpperTolerance + change.originalLowerTolerance) / 2;
  const resultingCenter = (change.resultingUpperTolerance + change.resultingLowerTolerance) / 2;
  const nearlyEqual = (left: number, right: number) => Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
  if (!nearlyEqual(change.originalBand, originalBand)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "originalBand must match the original tolerance bounds", path: ["originalBand"] });
  }
  if (!nearlyEqual(change.resultingBand, resultingBand)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "resultingBand must match the resulting tolerance bounds", path: ["resultingBand"] });
  }
  if (!nearlyEqual(change.bandCenter, originalCenter) || !nearlyEqual(change.bandCenter, resultingCenter)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "bandCenter must be preserved by the tolerance change", path: ["bandCenter"] });
  }
});

export const f6ControlledScenarioSchema = z.object({
  scenarioId: z.string().min(1),
  optionKind: f6OptionKindSchema,
  factorOverrides: z.array(calculationFactorOverrideSchema).max(100),
  systemSpecification: calculationScenarioSystemSpecificationSchema.optional(),
}).strict().superRefine((scenario, context) => {
  if (scenario.factorOverrides.length === 0 && scenario.systemSpecification === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "controlled scenario requires at least one override" });
  }
});

export const f6FeasibilityAssessmentSchema = z.object({
  status: z.enum(["supported", "requires_engineering_review", "insufficient_evidence", "not_supported"]),
  reasonCodes: z.array(z.string().min(1)),
  evidenceReferences: z.array(f6RelativeArtifactPathSchema),
}).strict();

export const f6ReverseSolveResultSchema = z.object({
  targetCpk: z.number().finite().positive(),
  targetRssSigma: z.number().finite().nonnegative(),
  strategy: z.enum(["single-factor", "top-3", "rss-apportionment", "centering-plus-tighten"]),
  toleranceChanges: z.array(f6ToleranceChangeSchema),
  residualError: z.number().finite().nonnegative(),
}).strict();

export const f6ApportionmentResultSchema = z.object({
  policy: z.enum(["proportional-to-contribution", "equal-allocation-among-top-N", "bounded-by-capability", "residual-after-centering"]),
  targetRssSigma: z.number().finite().nonnegative(),
  allocations: z.array(z.object({
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    targetSigma: z.number().finite().nonnegative(),
    targetTolerance: z.number().finite().nonnegative(),
  }).strict()),
  residualError: z.number().finite().nonnegative(),
  feasibility: f6FeasibilityAssessmentSchema,
}).strict().superRefine((result, context) => {
  const seen = new Set<string>();
  result.allocations.forEach((allocation, index) => {
    const key = `${allocation.tableId}\u0000${allocation.sourceRow}`;
    if (seen.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "allocation source keys must be unique", path: ["allocations", index] });
    }
    seen.add(key);
  });
});

export const f6CapabilityBoundSchema = z.object({
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  minimumToleranceBand: z.number().finite().nonnegative(),
  maximumToleranceBand: z.number().finite().nonnegative(),
  evidenceReference: f6RelativeArtifactPathSchema,
}).strict().refine((bound) => bound.minimumToleranceBand <= bound.maximumToleranceBand, {
  message: "minimumToleranceBand must not exceed maximumToleranceBand",
  path: ["minimumToleranceBand"],
});

const f6VersionedEvidenceFields = {
  source: f6RelativeArtifactPathSchema,
  effectiveVersion: z.string().min(1),
  contentHash: sha256Schema,
};

export const f6SupplierCapabilityEvidenceSchema = z.object({
  evidenceVersion: z.literal("supplier-capability-v1"),
  supplierReference: z.string().min(1),
  processFamily: z.string().min(1),
  partCategory: z.string().min(1),
  capabilityTier: capabilityTierSchema,
  achievableToleranceBand: z.number().finite().nonnegative(),
  distribution: distributionSchema,
  ...f6VersionedEvidenceFields,
}).strict();

export const f6DatumEvidenceSchema = z.object({
  evidenceVersion: z.literal("datum-strategy-v1"),
  worksheetName: z.string().min(1),
  datumFace: z.string().min(1),
  stackStart: z.string().min(1),
  factorDirections: z.array(z.object({
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    direction: z.union([z.literal(-1), z.literal(1)]),
  }).strict()).min(1),
  datumChainEdges: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) }).strict()).min(1),
  crossSubsystemRelations: z.array(z.string().min(1)),
  drawingEvidence: z.array(f6RelativeArtifactPathSchema).min(1),
  reviewStatus: z.literal("confirmed"),
  ...f6VersionedEvidenceFields,
}).strict().superRefine((evidence, context) => {
  const seen = new Set<string>();
  evidence.factorDirections.forEach((direction, index) => {
    const key = `${direction.tableId}\u0000${direction.sourceRow}`;
    if (seen.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor direction source keys must be unique", path: ["factorDirections", index] });
    }
    seen.add(key);
  });
});

const validateF6GovernedEvidenceIdentities = (
  evidenceCollections: ReadonlyArray<readonly ["supplierCapabilityEvidence" | "datumEvidence", ReadonlyArray<{ source: string; contentHash: string }> | undefined]>,
  context: z.RefinementCtx,
): void => {
  evidenceCollections.forEach(([field, records]) => {
    const seen = new Set<string>();
    records?.forEach((record, index) => {
      const identity = `${record.source}\u0000${record.contentHash}`;
      if (seen.has(identity)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} governed identities must be unique`, path: [field, index] });
      }
      seen.add(identity);
    });
  });
};

export const f6CostEvidenceSchema = z.object({
  evidenceVersion: z.literal("cost-model-v1"),
  model: z.string().min(1),
  unit: z.string().min(1),
  optionCosts: z.array(z.object({ optionKind: f6OptionKindSchema, cost: z.number().finite().nonnegative() }).strict()).min(1),
  roiPolicyVersion: z.literal("f6-delta-cpk-per-cost-v1"),
  roiCalculationReference: f6ArtifactReferenceSchema,
  ...f6VersionedEvidenceFields,
}).strict().superRefine((evidence, context) => {
  const seen = new Set<string>();
  evidence.optionCosts.forEach(({ optionKind }, index) => {
    if (seen.has(optionKind)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "cost evidence option kinds must be unique", path: ["optionCosts", index, "optionKind"] });
    }
    seen.add(optionKind);
  });
});

const f6InputFindingBaseShape = {
  findingCode: z.string().min(1),
  severity: z.enum(["Critical", "Major", "Minor"]),
  message: z.string().min(1),
  evidenceReferences: z.array(f6ArtifactReferenceSchema),
};
const f6CapabilityImpactTrueSchema = z.literal(true).transform((value): boolean => value);
const f6CapabilityImpactFalseSchema = z.literal(false).transform((value): boolean => value);

export const f6InputFindingSchema = z.discriminatedUnion("findingKind", [
  z.object({
    ...f6InputFindingBaseShape,
    findingKind: z.literal("validation_abnormality"),
    affectsCapabilityData: z.boolean(),
  }).strict(),
  z.object({
    ...f6InputFindingBaseShape,
    findingKind: z.literal("confirmed_requirement_violation"),
    affectsCapabilityData: f6CapabilityImpactTrueSchema,
  }).strict(),
  z.object({
    ...f6InputFindingBaseShape,
    findingKind: z.literal("governance_gap"),
    affectsCapabilityData: f6CapabilityImpactFalseSchema,
  }).strict(),
  z.object({
    ...f6InputFindingBaseShape,
    findingKind: z.literal("optimization_failure"),
    affectsCapabilityData: f6CapabilityImpactFalseSchema,
  }).strict(),
]);

export const f6RiskSchema = z.object({
  riskId: z.string().min(1),
  category: z.enum(["Product", "Manufacturing", "Assembly", "Supplier", "Customer Experience"]),
  rating: z.enum(["Low", "Medium", "High", "Critical"]),
  status: z.enum(["open", "closed"]),
  reason: z.string().min(1),
  evidenceReferences: z.array(f6ArtifactReferenceSchema).min(1),
}).strict();

export const f6RecommendationSchema = z.object({
  recommendationId: z.string().min(1),
  optionId: z.string().min(1).optional(),
  text: z.string().min(1),
  evidenceReferences: z.array(f6ArtifactReferenceSchema).min(1),
}).strict();

export const f6ClarificationSchema = z.object({
  clarificationId: z.string().min(1),
  reasonCode: z.string().min(1),
  requiredInputs: z.array(z.string().min(1)).min(1),
  questionForReviewer: z.string().min(1),
  evidenceReferences: z.array(f6ArtifactReferenceSchema),
}).strict();

export const f6TargetCapabilitySchema = z.object({
  targetCpk: z.number().finite().positive(),
  targetSigmaLevel: z.number().finite().positive(),
  source: z.enum(["worksheet", "controlled_default"]),
}).strict();

const f6NearlyEqual = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));

const f6EvidenceScopeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("supplier"),
    supplierReference: z.string().min(1),
    processFamily: z.string().min(1),
    partCategory: z.string().min(1),
    evidenceReference: f6ArtifactReferenceSchema,
  }).strict(),
  z.object({
    kind: z.literal("datum"),
    worksheetName: z.string().min(1),
    factorSources: z.array(z.object({
      tableId: z.string().min(1),
      sourceRow: z.number().int().positive(),
      direction: z.union([z.literal(-1), z.literal(1)]),
    }).strict()).min(1),
    evidenceReference: f6ArtifactReferenceSchema,
  }).strict(),
]);

const f6CompletedOptionSchema = z.object({
  status: z.literal("completed"),
  optionId: z.string().min(1),
  optionKind: f6OptionKindSchema,
  baselineMetrics: f6MetricsSchema,
  resultMetrics: f6MetricsSchema,
  deltaCpk: z.number().finite(),
  deltaCp: z.number().finite(),
  deltaRssSigma: z.number().finite(),
  deltaDpm: z.number().finite(),
  deltaYield: z.number().finite(),
  factorOverrides: z.array(calculationFactorOverrideSchema),
  toleranceChanges: z.array(f6ToleranceChangeSchema),
  reverseSolve: f6ReverseSolveResultSchema.optional(),
  apportionment: f6ApportionmentResultSchema.optional(),
  feasibility: f6FeasibilityAssessmentSchema,
  evidenceReferences: z.array(f6ArtifactReferenceSchema),
  evidenceScope: f6EvidenceScopeSchema.optional(),
  relativeCost: z.union([z.number().finite().nonnegative(), z.literal("insufficient_evidence")]),
  roiScore: z.union([z.number().finite(), z.literal("not_computed")]),
  impactRank: z.number().int().positive().nullable(),
  scenarioEvidence: z.object({
    scenarioId: z.string().min(1),
    calculation: calculationCompletedResultSchema,
  }).strict(),
  closedRiskIds: z.array(z.string().min(1)),
}).strict();

const f6CalculationFailedOptionSchema = z.object({
  status: z.literal("calculation_failed"),
  optionId: z.string().min(1),
  optionKind: f6OptionKindSchema,
  reasonCode: z.string().min(1),
  evidenceReferences: z.array(f6ArtifactReferenceSchema),
  impactRank: z.null(),
}).strict();

const f6InsufficientEvidenceOptionSchema = z.object({
  status: z.literal("insufficient_evidence"),
  optionId: z.string().min(1),
  optionKind: z.enum(["improve_supplier_capability", "tighten_datum_strategy"]),
  predictedImprovement: z.literal("insufficient_evidence"),
  requiredInputs: z.array(z.string().min(1)).min(1),
  evidenceReferences: z.array(f6ArtifactReferenceSchema),
  feasibility: f6FeasibilityAssessmentSchema.optional(),
  evidenceScope: f6EvidenceScopeSchema.optional(),
  relativeCost: z.literal("insufficient_evidence"),
  roiScore: z.literal("not_computed"),
  impactRank: z.null(),
}).strict();

export const f6OptionSchema = z.discriminatedUnion("status", [
  f6CompletedOptionSchema,
  f6CalculationFailedOptionSchema,
  f6InsufficientEvidenceOptionSchema,
]).superRefine((option, context) => {
  if (option.status === "calculation_failed") return;
  const expectedScopeKind = option.optionKind === "improve_supplier_capability"
    ? "supplier"
    : option.optionKind === "tighten_datum_strategy"
      ? "datum"
      : undefined;
  if (expectedScopeKind === undefined && option.evidenceScope !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "evidenceScope is forbidden for this option kind", path: ["evidenceScope"] });
  } else if (expectedScopeKind !== undefined
    && option.evidenceScope !== undefined
    && option.evidenceScope.kind !== expectedScopeKind) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${expectedScopeKind} evidenceScope is required for this option kind`, path: ["evidenceScope"] });
  } else if (option.status === "completed" && expectedScopeKind !== undefined && option.evidenceScope === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${expectedScopeKind} evidenceScope is required for this option kind`, path: ["evidenceScope"] });
  }
  if (option.status === "insufficient_evidence") {
    if (option.evidenceReferences.length === 0 && option.evidenceScope !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "evidenceScope is forbidden without evidenceReferences", path: ["evidenceScope"] });
    } else if (option.evidenceScope !== undefined
      && !option.evidenceReferences.some((reference) =>
        reference.artifact === option.evidenceScope!.evidenceReference.artifact
        && reference.contentHash === option.evidenceScope!.evidenceReference.contentHash)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "evidenceScope reference must be included in evidenceReferences", path: ["evidenceScope", "evidenceReference"] });
    }
  }
  if (option.evidenceScope?.kind === "datum") {
    const seen = new Set<string>();
    option.evidenceScope.factorSources.forEach((source, index) => {
      const key = `${source.tableId}\u0000${source.sourceRow}`;
      if (seen.has(key)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "datum evidence scope factor sources must be unique", path: ["evidenceScope", "factorSources", index] });
      }
      seen.add(key);
    });
  }
  if (option.status !== "completed") return;
  const expectedDeltas = {
    deltaCpk: option.resultMetrics.cpk - option.baselineMetrics.cpk,
    deltaCp: option.resultMetrics.cp - option.baselineMetrics.cp,
    deltaRssSigma: option.resultMetrics.rssSigma - option.baselineMetrics.rssSigma,
    deltaDpm: option.resultMetrics.dpm - option.baselineMetrics.dpm,
    deltaYield: option.resultMetrics.yield - option.baselineMetrics.yield,
  };
  for (const [field, expected] of Object.entries(expectedDeltas) as Array<[keyof typeof expectedDeltas, number]>) {
    if (!f6NearlyEqual(option[field], expected)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must equal result minus baseline`, path: [field] });
    }
  }
});

export const f6SupplierBindingSchema = z.object({
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  evidenceReference: f6ArtifactReferenceSchema,
}).strict();

export const f6WorksheetInputSchema = z.object({
  worksheetName: z.string().min(1),
  f4CalculationIndex: z.number().int().positive(),
  baselineCalculationRequest: calculationRequestSchema,
  baselineCalculation: calculationCompletedResultSchema,
  f5Worksheet: f5CompletedWorksheetResultSchema,
  f3GovernanceRows: z.array(f3GovernanceRowSchema),
  f2Findings: z.array(f6InputFindingSchema),
  supplierBindings: z.array(f6SupplierBindingSchema),
}).strict().superRefine((worksheet, context) => {
  if (worksheet.baselineCalculationRequest.scenarioOverrides.length !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline calculation request must not contain scenarios", path: ["baselineCalculationRequest", "scenarioOverrides"] });
  }
  if (worksheet.baselineCalculationRequest.worksheetSelection.worksheetName !== worksheet.worksheetName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline request worksheet must match worksheetName", path: ["baselineCalculationRequest", "worksheetSelection", "worksheetName"] });
  }
  if (worksheet.baselineCalculationRequest.worksheetSelection.tableId !== worksheet.baselineCalculation.worksheetSelection.tableId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline request table must match baseline calculation", path: ["baselineCalculationRequest", "worksheetSelection", "tableId"] });
  }
  if (worksheet.baselineCalculationRequest.projectReference !== worksheet.baselineCalculation.projectReference
    || worksheet.baselineCalculationRequest.runReference !== worksheet.baselineCalculation.runReference) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline request project and run identities must match baseline calculation", path: ["baselineCalculationRequest"] });
  }
  if (worksheet.baselineCalculationRequest.worksheetAnalysisAssets.workbook.contentHash !== worksheet.baselineCalculation.workbookContentHash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline request workbook must match baseline calculation", path: ["baselineCalculationRequest", "worksheetAnalysisAssets", "workbook", "contentHash"] });
  }
  if (worksheet.baselineCalculation.worksheetSelection.worksheetName !== worksheet.worksheetName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline worksheet must match worksheetName", path: ["baselineCalculation", "worksheetSelection", "worksheetName"] });
  }
  if (worksheet.f5Worksheet.worksheetName !== worksheet.worksheetName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "F5 worksheet must match worksheetName", path: ["f5Worksheet", "worksheetName"] });
  }
  if (worksheet.f5Worksheet.calculationResult.workbookContentHash !== worksheet.baselineCalculation.workbookContentHash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "F5 and baseline workbook hashes must match", path: ["f5Worksheet", "calculationResult", "workbookContentHash"] });
  }
  if (worksheet.f5Worksheet.calculationResult.runReference !== worksheet.baselineCalculation.runReference) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "F5 and baseline run references must match", path: ["f5Worksheet", "calculationResult", "runReference"] });
  }
  if (JSON.stringify(worksheet.f3GovernanceRows) !== JSON.stringify(worksheet.f5Worksheet.governanceRows)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "F3 governance rows must match the F5 worksheet", path: ["f3GovernanceRows"] });
  }
  const baselineSourceKeys = new Set(worksheet.baselineCalculation.factors.map(({ source }) => `${source.tableId}\u0000${source.sourceRow}`));
  const governanceSourceKeys = new Set(worksheet.f3GovernanceRows.map(({ source }) => `${source.tableId}\u0000${source.sourceRow}`));
  const bindingSourceKeys = new Set<string>();
  worksheet.supplierBindings.forEach((binding, index) => {
    const sourceKey = `${binding.tableId}\u0000${binding.sourceRow}`;
    if (bindingSourceKeys.has(sourceKey)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "supplier binding source keys must be unique", path: ["supplierBindings", index] });
    }
    bindingSourceKeys.add(sourceKey);
    if (!baselineSourceKeys.has(sourceKey) || !governanceSourceKeys.has(sourceKey)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "supplier binding source must exist in baseline factors and F3 governance rows", path: ["supplierBindings", index] });
    }
  });
});

export const f6OptimizationRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  workbook: z.object({ fileName: workbookCatalogFileNameSchema, contentHash: sha256Schema }).strict(),
  selectedWorksheetNames: z.array(z.string().min(1)).min(1),
  reportScope: z.object({
    worksheetNames: z.array(z.string().min(1)).min(1),
    blockedWorksheetNames: z.array(z.string().min(1)),
  }).strict(),
  f2Reference: f6ArtifactReferenceSchema,
  f3Reference: f6ArtifactReferenceSchema,
  f4Reference: f6F4ReferenceSchema,
  f5Reference: f6F5ReferenceSchema,
  f0Versions: z.object({
    knowledgeBaseVersion: z.literal("v1"),
    capabilityVersion: z.string().min(1),
    interpretationVersion: z.literal("interpretation-rules-v1"),
  }).strict(),
  scenarioPolicyVersion: z.literal("f6-scenario-policy-v1"),
  imageObservationReference: f6ArtifactReferenceSchema.optional(),
  supplierCapabilityReference: f6ArtifactReferenceSchema.optional(),
  datumStrategyReference: f6ArtifactReferenceSchema.optional(),
  costReference: f6ArtifactReferenceSchema.optional(),
  supplierCapabilityEvidence: z.array(f6SupplierCapabilityEvidenceSchema).optional(),
  datumEvidence: z.array(f6DatumEvidenceSchema).optional(),
  costEvidence: f6CostEvidenceSchema.optional(),
  worksheets: z.array(f6WorksheetInputSchema).min(1),
}).strict().superRefine((request, context) => {
  const selected = request.selectedWorksheetNames;
  const selectedSet = new Set<string>();
  selected.forEach((name, index) => {
    if (selectedSet.has(name)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "selected worksheet names must be unique", path: ["selectedWorksheetNames", index] });
    }
    selectedSet.add(name);
  });
  const worksheetNameSet = new Set<string>();
  request.worksheets.forEach(({ worksheetName }, index) => {
    if (worksheetNameSet.has(worksheetName)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet input names must be unique", path: ["worksheets", index, "worksheetName"] });
    }
    worksheetNameSet.add(worksheetName);
  });
  if (selectedSet.size !== worksheetNameSet.size || [...selectedSet].some((name) => !worksheetNameSet.has(name))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "selected worksheet names must exactly match worksheet inputs", path: ["selectedWorksheetNames"] });
  }
  const scopeNames = request.reportScope.worksheetNames;
  const blockedScopeNames = request.reportScope.blockedWorksheetNames;
  const scopeNameSet = new Set(scopeNames);
  const blockedScopeNameSet = new Set(blockedScopeNames);
  if (scopeNameSet.size !== scopeNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "report scope worksheet names must be unique", path: ["reportScope", "worksheetNames"] });
  }
  if (blockedScopeNameSet.size !== blockedScopeNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "blocked report scope worksheet names must be unique", path: ["reportScope", "blockedWorksheetNames"] });
  }
  if (blockedScopeNames.some((name) => !scopeNameSet.has(name))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "blocked report scope names must be a subset of worksheet names", path: ["reportScope", "blockedWorksheetNames"] });
  }
  const nonblockedScopeNameSet = new Set(scopeNames.filter((name) => !blockedScopeNameSet.has(name)));
  if (nonblockedScopeNameSet.size !== selectedSet.size || [...selectedSet].some((name) => !nonblockedScopeNameSet.has(name))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "selected worksheet names must match nonblocked report scope", path: ["reportScope"] });
  }
  validateF6GovernedEvidenceIdentities([
    ["supplierCapabilityEvidence", request.supplierCapabilityEvidence],
    ["datumEvidence", request.datumEvidence],
  ], context);
  request.worksheets.forEach((worksheet, index) => {
    if (worksheet.baselineCalculation.workbookContentHash !== request.workbook.contentHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline workbook hash must match request workbook", path: ["worksheets", index, "baselineCalculation", "workbookContentHash"] });
    }
    const expectedRunReference = `${request.f4Reference.runId}-${worksheet.f4CalculationIndex}`;
    if (worksheet.baselineCalculation.runReference !== expectedRunReference
      || worksheet.baselineCalculationRequest.runReference !== expectedRunReference) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline run must derive from the F4 reference and calculation index", path: ["worksheets", index, "baselineCalculation", "runReference"] });
    }
    worksheet.supplierBindings.forEach((binding, bindingIndex) => {
      const matchingEvidence = (request.supplierCapabilityEvidence ?? []).filter((evidence) =>
        evidence.source === binding.evidenceReference.artifact
        && evidence.contentHash === binding.evidenceReference.contentHash);
      if (matchingEvidence.length !== 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "supplier binding must resolve to exactly one governed evidence record",
          path: ["worksheets", index, "supplierBindings", bindingIndex, "evidenceReference"],
        });
        return;
      }
      const governanceRow = worksheet.f3GovernanceRows.find(({ source }) =>
        source.tableId === binding.tableId && source.sourceRow === binding.sourceRow);
      if (governanceRow !== undefined && matchingEvidence[0]!.partCategory !== governanceRow.partCategory) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bound supplier evidence partCategory must match the F3 governance row",
          path: ["worksheets", index, "supplierBindings", bindingIndex, "evidenceReference"],
        });
      }
    });
  });
});

const f6HighestImpactActionSchema = z.object({
  optionId: z.string().min(1),
  rationale: z.string().min(1),
}).strict();

const f6BaselineFactorIdentitySchema = calculationFactorResultSchema.omit({ trace: true });

export const f6BaselineIdentitySchema = z.object({
  projectReference: controlledCalculationReferenceSchema,
  runReference: controlledCalculationReferenceSchema,
  calculationVersion: z.literal("excel-ta-v1"),
  workbookContentHash: sha256Schema,
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  factorCount: z.number().int().positive(),
  factors: z.array(f6BaselineFactorIdentitySchema).min(1),
  system: calculationSystemResultSchema,
  capability: calculationCapabilityResultSchema,
}).strict().superRefine((identity, context) => {
  if (identity.factorCount !== identity.factors.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "factorCount must match baseline identity factors", path: ["factorCount"] });
  }
  const sourceKeys = new Set<string>();
  identity.factors.forEach((factor, index) => {
    if (factor.source.worksheetName !== identity.worksheetName || factor.source.tableId !== identity.tableId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor source must match baseline worksheet and table", path: ["factors", index, "source"] });
    }
    const key = `${factor.source.worksheetName}\u0000${factor.source.tableId}\u0000${factor.source.sourceRow}`;
    if (sourceKeys.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline factor source keys must be unique", path: ["factors", index, "source"] });
    }
    sourceKeys.add(key);
  });
});

const f6ReadyWorksheetFields = {
  worksheetName: z.string().min(1),
  f4CalculationIndex: z.number().int().positive(),
  baselineIdentity: f6BaselineIdentitySchema,
  baselineMetrics: f6MetricsSchema,
  targetCapability: f6TargetCapabilitySchema,
  inputFindings: z.array(f6InputFindingSchema),
  options: z.array(f6OptionSchema).min(1),
  risks: z.array(f6RiskSchema),
  recommendations: z.array(f6RecommendationSchema),
  highestImpactAction: f6HighestImpactActionSchema.optional(),
  roiStatus: z.enum(["computed", "not_computed"]),
  clarifications: z.array(f6ClarificationSchema),
};

const f6FixedReportOptionKinds = [
  "reduce_top_contributor_20",
  "reduce_top_3_contributors_30",
  "improve_supplier_capability",
  "tighten_datum_strategy",
] as const;

const validateF6ReadyWorksheet = (
  worksheet: {
    status: "completed" | "partially_completed" | "calculation_failed";
    options: Array<z.infer<typeof f6OptionSchema>>;
    recommendations: Array<z.infer<typeof f6RecommendationSchema>>;
    highestImpactAction?: z.infer<typeof f6HighestImpactActionSchema> | undefined;
    roiStatus: "computed" | "not_computed";
  },
  context: z.RefinementCtx,
): void => {
  const failedCount = worksheet.options.filter(({ status }) => status === "calculation_failed").length;
  const completedCount = worksheet.options.filter(({ status }) => status === "completed").length;
  f6FixedReportOptionKinds.forEach((optionKind) => {
    if (worksheet.options.filter((option) => option.optionKind === optionKind).length !== 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `worksheet requires exactly one ${optionKind} option`, path: ["options"] });
    }
  });
  if (worksheet.status === "completed" && failedCount > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "completed worksheet must not contain calculation_failed options", path: ["status"] });
  }
  if (worksheet.status === "partially_completed" && (failedCount === 0 || completedCount === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "partially_completed requires completed and calculation_failed options", path: ["status"] });
  }
  if (worksheet.status === "calculation_failed") {
    if (failedCount === 0 || completedCount > 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "calculation_failed requires at least one failed option and no completed options", path: ["status"] });
    }
    if (worksheet.recommendations.length > 0 || worksheet.highestImpactAction !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "calculation_failed forbids recommendations and highest impact action", path: ["recommendations"] });
    }
    if (worksheet.roiStatus !== "not_computed") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "calculation_failed requires ROI to remain uncomputed", path: ["roiStatus"] });
    }
  }
};

const f6CompletedWorksheetResultSchema = z.object({
  status: z.literal("completed"),
  ...f6ReadyWorksheetFields,
}).strict().superRefine(validateF6ReadyWorksheet);

const f6PartiallyCompletedWorksheetResultSchema = z.object({
  status: z.literal("partially_completed"),
  ...f6ReadyWorksheetFields,
}).strict().superRefine(validateF6ReadyWorksheet);

const f6CalculationFailedWorksheetResultSchema = z.object({
  status: z.literal("calculation_failed"),
  ...f6ReadyWorksheetFields,
}).strict().superRefine(validateF6ReadyWorksheet);

const f6InputRejectedWorksheetResultSchema = z.object({
  worksheetName: z.string().min(1),
  f4CalculationIndex: z.number().int().positive(),
  baselineIdentity: f6BaselineIdentitySchema,
  status: z.literal("input_rejected"),
  inputFindings: z.array(f6InputFindingSchema).min(1),
  options: z.array(z.never()).length(0),
  risks: z.array(f6RiskSchema),
  clarifications: z.array(f6ClarificationSchema),
}).strict();

export const f6WorksheetResultSchema = z.union([
  f6CompletedWorksheetResultSchema,
  f6PartiallyCompletedWorksheetResultSchema,
  f6CalculationFailedWorksheetResultSchema,
  f6InputRejectedWorksheetResultSchema,
]);

export const f6SummarySchema = z.object({
  worksheetCount: z.number().int().nonnegative(),
  completedWorksheetCount: z.number().int().nonnegative(),
  partiallyCompletedWorksheetCount: z.number().int().nonnegative(),
  calculationFailedWorksheetCount: z.number().int().nonnegative(),
  inputRejectedWorksheetCount: z.number().int().nonnegative(),
  completedOptionCount: z.number().int().nonnegative(),
  calculationFailedOptionCount: z.number().int().nonnegative(),
  insufficientEvidenceOptionCount: z.number().int().nonnegative(),
}).strict();

export const f6ProvenanceSchema = z.object({
  f2Reference: f6ArtifactReferenceSchema,
  f3Reference: f6ArtifactReferenceSchema,
  f4Reference: f6F4ReferenceSchema,
  f5Reference: f6F5ReferenceSchema,
  reportScope: z.object({
    worksheetNames: z.array(z.string().min(1)).min(1),
    blockedWorksheetNames: z.array(z.string().min(1)),
  }).strict(),
  f0Versions: z.object({
    knowledgeBaseVersion: z.literal("v1"),
    capabilityVersion: z.string().min(1),
    interpretationVersion: z.literal("interpretation-rules-v1"),
  }).strict(),
  scenarioPolicyVersion: z.literal("f6-scenario-policy-v1"),
  imageObservationReference: f6ArtifactReferenceSchema.optional(),
  supplierCapabilityEvidence: z.array(f6SupplierCapabilityEvidenceSchema).optional(),
  datumEvidence: z.array(f6DatumEvidenceSchema).optional(),
  costEvidence: f6CostEvidenceSchema.optional(),
}).strict().superRefine((provenance, context) => {
  validateF6GovernedEvidenceIdentities([
    ["supplierCapabilityEvidence", provenance.supplierCapabilityEvidence],
    ["datumEvidence", provenance.datumEvidence],
  ], context);
  const scopeNames = provenance.reportScope.worksheetNames;
  const blockedScopeNames = provenance.reportScope.blockedWorksheetNames;
  const scopeNameSet = new Set(scopeNames);
  const blockedScopeNameSet = new Set(blockedScopeNames);
  if (scopeNameSet.size !== scopeNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "report scope worksheet names must be unique", path: ["reportScope", "worksheetNames"] });
  }
  if (blockedScopeNameSet.size !== blockedScopeNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "blocked report scope worksheet names must be unique", path: ["reportScope", "blockedWorksheetNames"] });
  }
  if (blockedScopeNames.some((name) => !scopeNameSet.has(name))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "blocked report scope names must be a subset of worksheet names", path: ["reportScope", "blockedWorksheetNames"] });
  }
});

export const f6LegacyOptimizationResultSchema = z.object({
  contractVersion: contractVersionSchema,
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F6"),
  status: z.enum(["completed", "partially_completed", "calculation_failed", "input_rejected"]),
  optimizationVersion: z.literal("f6-optimization-v1"),
  workbook: z.object({ fileName: workbookCatalogFileNameSchema, contentHash: sha256Schema }).strict(),
  worksheets: z.array(f6WorksheetResultSchema).min(1),
  summary: f6SummarySchema,
  provenance: f6ProvenanceSchema,
}).strict().superRefine((result, context) => {
  const worksheetNames = new Set<string>();
  result.worksheets.forEach(({ worksheetName }, index) => {
    if (worksheetNames.has(worksheetName)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet result names must be unique", path: ["worksheets", index, "worksheetName"] });
    }
    worksheetNames.add(worksheetName);
  });
  const statusCounts = {
    completed: result.worksheets.filter(({ status }) => status === "completed").length,
    partially_completed: result.worksheets.filter(({ status }) => status === "partially_completed").length,
    calculation_failed: result.worksheets.filter(({ status }) => status === "calculation_failed").length,
    input_rejected: result.worksheets.filter(({ status }) => status === "input_rejected").length,
  };
  const options = result.worksheets.flatMap((worksheet) => worksheet.options);
  const summaryChecks: Array<[keyof z.infer<typeof f6SummarySchema>, number]> = [
    ["worksheetCount", result.worksheets.length],
    ["completedWorksheetCount", statusCounts.completed],
    ["partiallyCompletedWorksheetCount", statusCounts.partially_completed],
    ["calculationFailedWorksheetCount", statusCounts.calculation_failed],
    ["inputRejectedWorksheetCount", statusCounts.input_rejected],
    ["completedOptionCount", options.filter(({ status }) => status === "completed").length],
    ["calculationFailedOptionCount", options.filter(({ status }) => status === "calculation_failed").length],
    ["insufficientEvidenceOptionCount", options.filter(({ status }) => status === "insufficient_evidence").length],
  ];
  summaryChecks.forEach(([field, expected]) => {
    if (result.summary[field] !== expected) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must match worksheet results`, path: ["summary", field] });
    }
  });
  const expectedStatus = statusCounts.input_rejected === result.worksheets.length
    ? "input_rejected"
    : statusCounts.calculation_failed === result.worksheets.length
      ? "calculation_failed"
      : statusCounts.partially_completed > 0 || statusCounts.calculation_failed > 0 || statusCounts.input_rejected > 0
      ? "partially_completed"
      : "completed";
  if (result.status !== expectedStatus) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "root status must match worksheet statuses", path: ["status"] });
  }
  result.worksheets.forEach((worksheet, worksheetIndex) => {
    if (worksheet.baselineIdentity.worksheetName !== worksheet.worksheetName) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline identity worksheet must match worksheet result", path: ["worksheets", worksheetIndex, "baselineIdentity", "worksheetName"] });
    }
    if (worksheet.baselineIdentity.workbookContentHash !== result.workbook.contentHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline identity workbook must match result workbook", path: ["worksheets", worksheetIndex, "baselineIdentity", "workbookContentHash"] });
    }
    if (worksheet.baselineIdentity.calculationVersion !== result.provenance.f4Reference.calculationVersion) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline calculation version must match F4 provenance", path: ["worksheets", worksheetIndex, "baselineIdentity", "calculationVersion"] });
    }
    const expectedRunReference = `${result.provenance.f4Reference.runId}-${worksheet.f4CalculationIndex}`;
    if (worksheet.baselineIdentity.runReference !== expectedRunReference) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline run must derive from F4 provenance and calculation index", path: ["worksheets", worksheetIndex, "baselineIdentity", "runReference"] });
    }
    const validateUniqueField = <T>(
      records: readonly T[],
      field: keyof T,
      collection: "options" | "risks" | "recommendations" | "clarifications",
    ): void => {
      const seen = new Set<unknown>();
      records.forEach((record, recordIndex) => {
        const value = record[field];
        if (seen.has(value)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: `${String(field)} must be unique per worksheet`, path: ["worksheets", worksheetIndex, collection, recordIndex, String(field)] });
        }
        seen.add(value);
      });
    };
    validateUniqueField(worksheet.risks, "riskId", "risks");
    validateUniqueField(worksheet.clarifications, "clarificationId", "clarifications");
    if (worksheet.status === "input_rejected") return;
    if (worksheet.targetCapability.source === "controlled_default"
      && (worksheet.targetCapability.targetCpk !== 1.33 || worksheet.targetCapability.targetSigmaLevel !== 4)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "controlled default target must be Cpk 1.33 at sigma level 4", path: ["worksheets", worksheetIndex, "targetCapability"] });
    }
    validateUniqueField(worksheet.options, "optionId", "options");
    validateUniqueField(worksheet.recommendations, "recommendationId", "recommendations");
    const seenRanks = new Set<number>();
    worksheet.options.forEach((option, optionIndex) => {
      if (option.status !== "completed" || option.impactRank === null) return;
      const impactRank = option.impactRank;
      if (seenRanks.has(impactRank)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "nonnull impactRank must be unique per worksheet", path: ["worksheets", worksheetIndex, "options", optionIndex, "impactRank"] });
      }
      seenRanks.add(impactRank);
    });

    const optionById = new Map(worksheet.options.map((option) => [option.optionId, option]));
    worksheet.recommendations.forEach((recommendation, recommendationIndex) => {
      const option = recommendation.optionId === undefined ? undefined : optionById.get(recommendation.optionId);
      if (recommendation.optionId !== undefined
        && (option?.status !== "completed" || option.feasibility.status !== "supported")) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "recommendations may reference only completed supported options", path: ["worksheets", worksheetIndex, "recommendations", recommendationIndex, "optionId"] });
      }
    });
    const highestImpactOption = worksheet.highestImpactAction === undefined
      ? undefined
      : optionById.get(worksheet.highestImpactAction.optionId);
    if (worksheet.highestImpactAction !== undefined
      && (highestImpactOption?.status !== "completed" || highestImpactOption.feasibility.status !== "supported")) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "highest impact action must reference a completed supported option", path: ["worksheets", worksheetIndex, "highestImpactAction", "optionId"] });
    }
    const costEvidence = result.provenance.costEvidence;
    if (costEvidence === undefined && worksheet.roiStatus !== "not_computed") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "ROI must not be computed without controlled cost evidence", path: ["worksheets", worksheetIndex, "roiStatus"] });
    }
    if (worksheet.roiStatus === "computed") {
      const rankedSupportedOptions = worksheet.options.filter((option): option is z.infer<typeof f6CompletedOptionSchema> =>
        option.status === "completed" && option.feasibility.status === "supported" && option.impactRank !== null);
      if (rankedSupportedOptions.length === 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "computed ROI requires a ranked supported completed option", path: ["worksheets", worksheetIndex, "roiStatus"] });
      }
      rankedSupportedOptions.forEach((option) => {
        const optionIndex = worksheet.options.indexOf(option);
        if (typeof option.relativeCost !== "number" || option.relativeCost <= 0 || typeof option.roiScore !== "number") {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "computed ROI requires positive matching cost evidence and numeric option values", path: ["worksheets", worksheetIndex, "options", optionIndex] });
        }
      });
    }
    worksheet.options.forEach((option, optionIndex) => {
      if (option.status === "calculation_failed") return;
      const referencesEvidence = (evidence: { source: string; contentHash: string }): boolean =>
        option.evidenceReferences.some((reference) =>
          reference.artifact === evidence.source && reference.contentHash === evidence.contentHash);
      if (option.optionKind === "improve_supplier_capability"
        && option.evidenceScope === undefined
        && (result.provenance.supplierCapabilityEvidence ?? []).some(referencesEvidence)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "supplier evidenceScope is required when governed supplier evidence is referenced", path: ["worksheets", worksheetIndex, "options", optionIndex, "evidenceScope"] });
      }
      if (option.optionKind === "tighten_datum_strategy"
        && option.evidenceScope === undefined
        && (result.provenance.datumEvidence ?? []).some(referencesEvidence)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "datum evidenceScope is required when governed datum evidence is referenced", path: ["worksheets", worksheetIndex, "options", optionIndex, "evidenceScope"] });
      }
      if (option.optionKind === "improve_supplier_capability" && option.evidenceScope?.kind === "supplier") {
        const scope = option.evidenceScope;
        const matches = (result.provenance.supplierCapabilityEvidence ?? []).filter((evidence) =>
          evidence.source === scope.evidenceReference.artifact
          && evidence.contentHash === scope.evidenceReference.contentHash
          && evidence.supplierReference === scope.supplierReference
          && evidence.processFamily === scope.processFamily
          && evidence.partCategory === scope.partCategory);
        if (matches.length !== 1) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "supplier option evidenceScope must match exactly one governed evidence entry", path: ["worksheets", worksheetIndex, "options", optionIndex, "evidenceScope"] });
        }
      }
      if (option.optionKind === "tighten_datum_strategy" && option.evidenceScope?.kind === "datum") {
        const scope = option.evidenceScope;
        if (scope.worksheetName !== worksheet.worksheetName) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "datum option evidenceScope worksheet must match the parent worksheet", path: ["worksheets", worksheetIndex, "options", optionIndex, "evidenceScope", "worksheetName"] });
        }
        const matches = (result.provenance.datumEvidence ?? []).filter((evidence) => {
          if (evidence.source !== scope.evidenceReference.artifact
            || evidence.contentHash !== scope.evidenceReference.contentHash
            || evidence.worksheetName !== scope.worksheetName) return false;
          const evidenceSources = new Set(evidence.factorDirections.map(({ tableId, sourceRow, direction }) => `${tableId}\u0000${sourceRow}\u0000${direction}`));
          return scope.factorSources.length === evidenceSources.size
            && scope.factorSources.every(({ tableId, sourceRow, direction }) => evidenceSources.has(`${tableId}\u0000${sourceRow}\u0000${direction}`));
        });
        if (matches.length !== 1) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "datum option evidenceScope must match exactly one governed evidence entry", path: ["worksheets", worksheetIndex, "options", optionIndex, "evidenceScope"] });
        }
      }
      if (option.status !== "completed") return;
      const closedRiskIds = new Set(option.closedRiskIds);
      if (closedRiskIds.size !== option.closedRiskIds.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "closedRiskIds must be unique", path: ["worksheets", worksheetIndex, "options", optionIndex, "closedRiskIds"] });
      }
      option.closedRiskIds.forEach((riskId, riskIndex) => {
        const risk = worksheet.risks.find((candidate) => candidate.riskId === riskId);
        if (risk === undefined) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "closedRiskIds must identify parent worksheet risks", path: ["worksheets", worksheetIndex, "options", optionIndex, "closedRiskIds", riskIndex] });
        } else if (risk.rating !== "High" && risk.rating !== "Critical") {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "closedRiskIds may identify only High or Critical risks", path: ["worksheets", worksheetIndex, "options", optionIndex, "closedRiskIds", riskIndex] });
        } else if (risk.status !== "closed"
          && !(risk.riskId.endsWith(":f5:capability-below-target")
            && option.resultMetrics.cpk >= worksheet.targetCapability.targetCpk)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "open risks require explicit option closure evidence", path: ["worksheets", worksheetIndex, "options", optionIndex, "closedRiskIds", riskIndex] });
        }
      });
      if (option.scenarioEvidence.scenarioId !== option.optionId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario evidence must match optionId", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "scenarioId"] });
      }
      const scenarioCalculation = option.scenarioEvidence.calculation;
      if (scenarioCalculation.workbookContentHash !== result.workbook.contentHash) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario evidence workbook must match result workbook", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "calculation", "workbookContentHash"] });
      }
      if (scenarioCalculation.runReference !== `${result.provenance.f4Reference.runId}-${worksheet.f4CalculationIndex}`) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario evidence run must derive from F4 provenance and calculation index", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "calculation", "runReference"] });
      }
      if (scenarioCalculation.worksheetSelection.worksheetName !== worksheet.worksheetName) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario evidence worksheet must match parent worksheet", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "calculation", "worksheetSelection", "worksheetName"] });
      }
      const scenarioBaselineMetrics = {
        mean: scenarioCalculation.system.mean,
        rssSigma: scenarioCalculation.system.rssSigma,
        cp: scenarioCalculation.capability.cp,
        cpk: scenarioCalculation.capability.cpk,
        yield: scenarioCalculation.capability.yield,
        dpm: scenarioCalculation.capability.totalDpm,
      };
      for (const field of ["mean", "rssSigma", "cp", "cpk", "yield", "dpm"] as const) {
        if (!f6NearlyEqual(option.baselineMetrics[field], scenarioBaselineMetrics[field])) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario evidence baseline must match option baseline metrics", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "calculation", field] });
        }
      }
      if (scenarioCalculation.scenarios.length !== 1) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario evidence calculation must contain exactly one scenario", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "calculation", "scenarios"] });
      }
      const matchingScenarios = option.scenarioEvidence.calculation.scenarios.filter(({ scenarioId }) => scenarioId === option.optionId);
      if (matchingScenarios.length !== 1) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario evidence calculation must contain the option scenario exactly once", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "calculation", "scenarios"] });
      } else {
        const scenario = matchingScenarios[0]!;
        if (scenario.baselineRunReference !== scenarioCalculation.runReference) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario baseline run must match scenario calculation run", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "calculation", "scenarios", 0, "baselineRunReference"] });
        }
        const expectedOverrideFactors = option.factorOverrides.map(({ worksheetName, tableId, sourceRow, ...fields }) => ({
          source: { worksheetName, tableId, sourceRow },
          fields: Object.keys(fields).sort(),
        }));
        const actualOverrideFactors = scenario.overrides.factors.map(({ source, fields }) => ({
          source,
          fields: [...fields].sort(),
        }));
        if (JSON.stringify(actualOverrideFactors) !== JSON.stringify(expectedOverrideFactors)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario overrides must match option factor overrides", path: ["worksheets", worksheetIndex, "options", optionIndex, "scenarioEvidence", "calculation", "scenarios", 0, "overrides", "factors"] });
        }
        const scenarioMetrics = {
          mean: scenario.calculation.system.mean,
          rssSigma: scenario.calculation.system.rssSigma,
          cp: scenario.calculation.capability.cp,
          cpk: scenario.calculation.capability.cpk,
          yield: scenario.calculation.capability.yield,
          dpm: scenario.calculation.capability.totalDpm,
        };
        for (const field of ["mean", "rssSigma", "cp", "cpk", "yield", "dpm"] as const) {
          if (!f6NearlyEqual(option.resultMetrics[field], scenarioMetrics[field])) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "resultMetrics must match scenario evidence calculation", path: ["worksheets", worksheetIndex, "options", optionIndex, "resultMetrics", field] });
          }
        }
        const scenarioDeltas = {
          deltaCpk: scenario.deltas.cpk,
          deltaRssSigma: scenario.deltas.rssSigma,
          deltaDpm: scenario.deltas.totalDpm,
          deltaYield: scenario.deltas.yield,
        };
        for (const field of ["deltaCpk", "deltaRssSigma", "deltaDpm", "deltaYield"] as const) {
          if (!f6NearlyEqual(option[field], scenarioDeltas[field])) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "option deltas must match scenario evidence deltas", path: ["worksheets", worksheetIndex, "options", optionIndex, field] });
          }
        }
      }
      for (const field of ["mean", "rssSigma", "cp", "cpk", "yield", "dpm"] as const) {
        if (!f6NearlyEqual(option.baselineMetrics[field], worksheet.baselineMetrics[field])) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "option baseline metrics must match the parent worksheet", path: ["worksheets", worksheetIndex, "options", optionIndex, "baselineMetrics", field] });
        }
      }
      option.factorOverrides.forEach((override, overrideIndex) => {
        if (override.worksheetName !== worksheet.worksheetName) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "factor override worksheet must match the parent worksheet", path: ["worksheets", worksheetIndex, "options", optionIndex, "factorOverrides", overrideIndex, "worksheetName"] });
        }
      });
      option.toleranceChanges.forEach((change, changeIndex) => {
        if (change.worksheetName !== worksheet.worksheetName) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "tolerance change worksheet must match the parent worksheet", path: ["worksheets", worksheetIndex, "options", optionIndex, "toleranceChanges", changeIndex, "worksheetName"] });
        }
      });
      option.reverseSolve?.toleranceChanges.forEach((change, changeIndex) => {
        if (change.worksheetName !== worksheet.worksheetName) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "reverse-solve tolerance change worksheet must match the parent worksheet", path: ["worksheets", worksheetIndex, "options", optionIndex, "reverseSolve", "toleranceChanges", changeIndex, "worksheetName"] });
        }
      });
      if (worksheet.roiStatus === "not_computed" && option.roiScore !== "not_computed") {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "not-computed ROI requires every completed option ROI score to remain uncomputed", path: ["worksheets", worksheetIndex, "options", optionIndex, "roiScore"] });
      }
      if (typeof option.relativeCost === "number") {
        const matchingCosts = costEvidence?.optionCosts.filter(({ optionKind }) => optionKind === option.optionKind) ?? [];
        if (matchingCosts.length !== 1 || !f6NearlyEqual(option.relativeCost, matchingCosts[0]!.cost)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "numeric relative cost must match exactly one governed cost evidence entry", path: ["worksheets", worksheetIndex, "options", optionIndex, "relativeCost"] });
        }
        if (costEvidence !== undefined) {
          const requiredReferences = [
            { artifact: costEvidence.source, contentHash: costEvidence.contentHash },
            costEvidence.roiCalculationReference,
          ];
          if (requiredReferences.some((required) => !option.evidenceReferences.some((reference) =>
            reference.artifact === required.artifact && reference.contentHash === required.contentHash))) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "numeric cost and ROI require cost source and calculation lineage", path: ["worksheets", worksheetIndex, "options", optionIndex, "evidenceReferences"] });
          }
        }
      } else if (worksheet.roiStatus !== "not_computed") {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "insufficient relative cost is allowed only when ROI is not computed", path: ["worksheets", worksheetIndex, "options", optionIndex, "relativeCost"] });
      }
      if (typeof option.roiScore === "number") {
        if (typeof option.relativeCost !== "number" || option.relativeCost <= 0) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "numeric ROI requires positive governed cost", path: ["worksheets", worksheetIndex, "options", optionIndex, "roiScore"] });
        } else {
          const expectedRoi = Math.max(option.deltaCpk, 0) / option.relativeCost;
          if (!f6NearlyEqual(option.roiScore, expectedRoi)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "ROI score must equal governed positive delta Cpk per cost", path: ["worksheets", worksheetIndex, "options", optionIndex, "roiScore"] });
          }
        }
      }
    });
    if (worksheet.roiStatus === "computed") {
      const rankedSupported = worksheet.options.filter((option): option is z.infer<typeof f6CompletedOptionSchema> =>
        option.status === "completed" && option.feasibility.status === "supported" && option.impactRank !== null);
      if (rankedSupported.length === 0 || rankedSupported.some((option) =>
        typeof option.relativeCost !== "number" || option.relativeCost <= 0 || typeof option.roiScore !== "number")) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "computed ROI requires positive cost and score for every ranked supported option", path: ["worksheets", worksheetIndex, "roiStatus"] });
      }
    }
  });
});

const f6MetricsV2Schema = z.object({
  mean: z.number().finite(),
  rssSigma: z.number().finite().nonnegative(),
  worstCaseLower: z.number().finite(),
  worstCaseUpper: z.number().finite(),
  cp: z.number().finite(),
  cpk: z.number().finite(),
  yield: z.number().finite().min(0).max(1).nullable(),
  dpm: z.number().finite().nonnegative().nullable(),
}).strict().superRefine((metrics, context) => {
  if (metrics.worstCaseUpper < metrics.worstCaseLower) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worstCaseUpper must not be below worstCaseLower", path: ["worstCaseUpper"] });
  }
});

const f6CandidateOptionV2Schema = z.object({
  optionId: z.string().min(1),
  status: z.literal("candidate"),
  reasonCode: z.literal("target_not_provided"),
  candidateFactors: z.array(f6FactorIdentitySchema).min(1),
  requiredInputs: z.array(z.string().min(1)).min(1),
  calculationMethod: z.string().min(1),
  baselineMetrics: f6MetricsV2Schema,
  impactRank: z.null(),
}).strict();

const f6ScenarioEvidenceV2Schema = z.object({
  targetId: z.string().min(1),
  baselineIdentity: f6InputBaselineIdentitySchema,
  factorOverrides: z.array(z.object({
    factor: f6FactorIdentitySchema,
    upperTolerance: z.number().finite().optional(),
    lowerTolerance: z.number().finite().optional(),
    sigma: z.number().finite().positive().optional(),
  }).strict().refine((override) => override.upperTolerance !== undefined
    || override.lowerTolerance !== undefined
    || override.sigma !== undefined, { message: "factor override requires at least one numeric field" })).min(1),
  calculationReference: f6ArtifactReferenceSchema,
  formulaReferences: z.array(f6V2FormulaReferenceSchema),
}).strict();

const f6CompletedOptionV2Schema = z.object({
  optionId: z.string().min(1),
  status: z.literal("completed"),
  targetId: z.string().min(1),
  baselineMetrics: f6MetricsV2Schema,
  resultMetrics: f6MetricsV2Schema,
  scenarioEvidence: f6ScenarioEvidenceV2Schema,
  targetContext: f6OptimizationTargetSchema.optional(),
  feasibility: f6FeasibilityAssessmentSchema,
  evidenceReferences: z.array(f6ArtifactReferenceSchema),
  impactRank: z.number().int().positive().nullable(),
}).strict();

const f6InsufficientEvidenceOptionV2Schema = z.object({
  optionId: z.string().min(1),
  status: z.literal("insufficient_evidence"),
  targetId: z.string().min(1).optional(),
  targetContext: f6OptimizationTargetSchema.optional(),
  requiredInputs: z.array(z.string().min(1)).min(1),
  baselineMetrics: f6MetricsV2Schema,
  evidenceReferences: z.array(f6ArtifactReferenceSchema),
  impactRank: z.null(),
}).strict();

const f6CalculationFailedOptionV2Schema = z.object({
  optionId: z.string().min(1),
  status: z.literal("calculation_failed"),
  targetId: z.string().min(1),
  targetContext: f6OptimizationTargetSchema.optional(),
  reasonCode: z.string().min(1),
  baselineMetrics: f6MetricsV2Schema,
  evidenceReferences: z.array(f6ArtifactReferenceSchema),
  impactRank: z.null(),
}).strict();

export const f6OptionV2Schema = z.discriminatedUnion("status", [
  f6CandidateOptionV2Schema,
  f6CompletedOptionV2Schema,
  f6InsufficientEvidenceOptionV2Schema,
  f6CalculationFailedOptionV2Schema,
]);

const f6TargetCapabilityV2Schema = z.object({
  targetCpk: z.number().finite().positive(),
  targetSigmaLevel: z.number().finite().positive(),
  source: z.enum(["WORKSHEET", "CONTROLLED_DEFAULT"]),
}).strict();

const f6HighestImpactActionV2Schema = z.object({
  optionId: z.string().min(1),
  impactRank: z.number().int().positive(),
}).strict();

const f6OptimizationWorksheetV2Schema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  runStatus: z.enum(["COMPLETED", "PARTIALLY_COMPLETED", "INPUT_REJECTED"]),
  baselineIdentity: f6InputBaselineIdentitySchema,
  baselineMetrics: f6MetricsV2Schema,
  targetCapability: f6TargetCapabilityV2Schema,
  options: z.array(f6OptionV2Schema),
  highestImpactAction: f6HighestImpactActionV2Schema.nullable(),
  findings: z.array(f6InputFindingSchema),
  risks: z.array(f6RiskSchema),
  recommendations: z.array(f6RecommendationSchema),
  clarifications: z.array(f6ClarificationSchema),
}).strict().superRefine((worksheet, context) => {
  if (worksheet.baselineIdentity.worksheetName !== worksheet.worksheetName
    || worksheet.baselineIdentity.tableId !== worksheet.tableId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baseline identity must match worksheet and table", path: ["baselineIdentity"] });
  }
  const optionIds = new Set<string>();
  worksheet.options.forEach((option, index) => {
    if (optionIds.has(option.optionId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "option IDs must be unique per worksheet", path: ["options", index, "optionId"] });
    }
    optionIds.add(option.optionId);
    if (option.status === "completed" && option.scenarioEvidence.targetId !== option.targetId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario targetId must match option targetId", path: ["options", index, "scenarioEvidence", "targetId"] });
    }
    if (option.status !== "candidate" && option.targetContext !== undefined && option.targetContext.targetId !== option.targetId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "target context targetId must match option targetId", path: ["options", index, "targetContext", "targetId"] });
    }
    for (const field of ["mean", "rssSigma", "worstCaseLower", "worstCaseUpper", "cp", "cpk"] as const) {
      if (!f6NearlyEqual(option.baselineMetrics[field], worksheet.baselineMetrics[field])) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "option baseline metrics must match worksheet baseline", path: ["options", index, "baselineMetrics", field] });
      }
    }
    for (const field of ["yield", "dpm"] as const) {
      if (option.baselineMetrics[field] !== worksheet.baselineMetrics[field]) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "option baseline metrics must match worksheet baseline", path: ["options", index, "baselineMetrics", field] });
      }
    }
  });
  const failedCount = worksheet.options.filter(({ status }) => status === "calculation_failed").length;
  if (worksheet.runStatus === "COMPLETED" && failedCount > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "completed worksheet must not contain failed options", path: ["runStatus"] });
  }
  if (worksheet.runStatus === "PARTIALLY_COMPLETED" && failedCount === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "partially completed worksheet requires a failed option", path: ["runStatus"] });
  }
  if (worksheet.runStatus === "INPUT_REJECTED" && (worksheet.options.length > 0 || worksheet.findings.length === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "input rejected worksheet requires findings and no options", path: ["runStatus"] });
  }
  const completedById = new Map(worksheet.options
    .filter((option): option is z.infer<typeof f6CompletedOptionV2Schema> => option.status === "completed")
    .map((option) => [option.optionId, option]));
  if (worksheet.highestImpactAction !== null) {
    const option = completedById.get(worksheet.highestImpactAction.optionId);
    if (option === undefined || option.feasibility.status !== "supported" || option.impactRank !== worksheet.highestImpactAction.impactRank) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "highest impact action must reference a ranked supported completed option", path: ["highestImpactAction"] });
    }
  }
  worksheet.recommendations.forEach((recommendation, index) => {
    if (recommendation.optionId === undefined) return;
    const option = completedById.get(recommendation.optionId);
    if (option === undefined || option.feasibility.status !== "supported") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "recommendations may reference only supported completed options", path: ["recommendations", index, "optionId"] });
    }
  });
});

const f6OptimizationSummaryV2Schema = z.object({
  worksheetCount: z.number().int().nonnegative(),
  completedWorksheetCount: z.number().int().nonnegative(),
  partiallyCompletedWorksheetCount: z.number().int().nonnegative(),
  inputRejectedWorksheetCount: z.number().int().nonnegative(),
  candidateOptionCount: z.number().int().nonnegative(),
  completedOptionCount: z.number().int().nonnegative(),
  insufficientEvidenceOptionCount: z.number().int().nonnegative(),
  calculationFailedOptionCount: z.number().int().nonnegative(),
}).strict();

const f6ProvenanceV2Schema = z.object({
  f2Reference: f6ArtifactReferenceSchema,
  f3Reference: f6ArtifactReferenceSchema,
  f4Reference: f6ArtifactReferenceSchema,
  f5Reference: f6ArtifactReferenceSchema,
  reportScope: z.object({
    worksheetNames: z.array(z.string().min(1)).min(1),
    blockedWorksheetNames: z.array(z.string().min(1)),
  }).strict(),
  imageObservationReference: f6ArtifactReferenceSchema.optional(),
  supplierCapabilityReference: f6ArtifactReferenceSchema.optional(),
  datumStrategyReference: f6ArtifactReferenceSchema.optional(),
  costReference: f6ArtifactReferenceSchema.optional(),
  supplierCapabilityDecision: f6InputDecisionSchema,
  datumStrategyDecision: f6InputDecisionSchema,
  costDecision: f6InputDecisionSchema,
  analysisContextDecision: f6InputDecisionSchema,
  optimizationTargetsDecision: f6InputDecisionSchema,
}).strict().superRefine((provenance, context) => {
  const scopeNames = provenance.reportScope.worksheetNames;
  const blockedScopeNames = provenance.reportScope.blockedWorksheetNames;
  const scopeNameSet = new Set(scopeNames);
  const blockedScopeNameSet = new Set(blockedScopeNames);
  if (scopeNameSet.size !== scopeNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "report scope worksheet names must be unique", path: ["reportScope", "worksheetNames"] });
  }
  if (blockedScopeNameSet.size !== blockedScopeNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "blocked report scope worksheet names must be unique", path: ["reportScope", "blockedWorksheetNames"] });
  }
  if (blockedScopeNames.some((name) => !scopeNameSet.has(name))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "blocked report scope names must be a subset of worksheet names", path: ["reportScope", "blockedWorksheetNames"] });
  }
});

export const f6OptimizationResultSchema = z.object({
  contractVersion: contractVersionSchema,
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F6"),
  optimizationVersion: z.literal("f6-optimization-v2"),
  runStatus: z.enum(["COMPLETED", "PARTIALLY_COMPLETED", "INPUT_REJECTED"]),
  workbook: z.object({ fileName: workbookCatalogFileNameSchema, contentHash: sha256Schema }).strict(),
  provenance: f6ProvenanceV2Schema,
  worksheets: z.array(f6OptimizationWorksheetV2Schema).min(1),
  summary: f6OptimizationSummaryV2Schema,
}).strict().superRefine((result, context) => {
  const worksheetNames = new Set<string>();
  result.worksheets.forEach((worksheet, index) => {
    if (worksheetNames.has(worksheet.worksheetName)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique", path: ["worksheets", index, "worksheetName"] });
    }
    worksheetNames.add(worksheet.worksheetName);
    if (worksheet.baselineIdentity.workbookContentHash !== result.workbook.contentHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet baseline workbook must match root workbook", path: ["worksheets", index, "baselineIdentity", "workbookContentHash"] });
    }
  });
  const blockedScopeNames = new Set(result.provenance.reportScope.blockedWorksheetNames);
  const nonblockedScopeNameSet = new Set(result.provenance.reportScope.worksheetNames.filter((name) => !blockedScopeNames.has(name)));
  if (nonblockedScopeNameSet.size !== result.worksheets.length
    || result.worksheets.some((worksheet) => !nonblockedScopeNameSet.has(worksheet.worksheetName))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "optimization worksheets must match nonblocked report scope", path: ["provenance", "reportScope"] });
  }
  const options = result.worksheets.flatMap(({ options }) => options);
  const expectedCounts = {
    worksheetCount: result.worksheets.length,
    completedWorksheetCount: result.worksheets.filter(({ runStatus }) => runStatus === "COMPLETED").length,
    partiallyCompletedWorksheetCount: result.worksheets.filter(({ runStatus }) => runStatus === "PARTIALLY_COMPLETED").length,
    inputRejectedWorksheetCount: result.worksheets.filter(({ runStatus }) => runStatus === "INPUT_REJECTED").length,
    candidateOptionCount: options.filter(({ status }) => status === "candidate").length,
    completedOptionCount: options.filter(({ status }) => status === "completed").length,
    insufficientEvidenceOptionCount: options.filter(({ status }) => status === "insufficient_evidence").length,
    calculationFailedOptionCount: options.filter(({ status }) => status === "calculation_failed").length,
  };
  for (const [field, expected] of Object.entries(expectedCounts) as Array<[keyof typeof expectedCounts, number]>) {
    if (result.summary[field] !== expected) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must match worksheet results`, path: ["summary", field] });
    }
  }
  const expectedStatus = expectedCounts.inputRejectedWorksheetCount === result.worksheets.length
    ? "INPUT_REJECTED"
    : expectedCounts.partiallyCompletedWorksheetCount > 0 || expectedCounts.inputRejectedWorksheetCount > 0
      ? "PARTIALLY_COMPLETED"
      : "COMPLETED";
  if (result.runStatus !== expectedStatus) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "root runStatus must match worksheet statuses", path: ["runStatus"] });
  }
});

export type F6OptionKind = z.infer<typeof f6OptionKindSchema>;
export type F6FactorIdentity = z.infer<typeof f6FactorIdentitySchema>;
export type F6InputBaselineIdentity = z.infer<typeof f6InputBaselineIdentitySchema>;
export type F6OptimizationTargets = z.infer<typeof f6OptimizationTargetsSchema>;
export type F6AnalysisContext = z.infer<typeof f6AnalysisContextSchema>;
export type F6InputDecision = z.infer<typeof f6InputDecisionSchema>;
export type F6Metrics = z.infer<typeof f6MetricsSchema>;
export type F6ToleranceChange = z.infer<typeof f6ToleranceChangeSchema>;
export type F6ControlledScenario = z.infer<typeof f6ControlledScenarioSchema>;
export type F6ReverseSolveResult = z.infer<typeof f6ReverseSolveResultSchema>;
export type F6ApportionmentResult = z.infer<typeof f6ApportionmentResultSchema>;
export type F6CapabilityBound = z.infer<typeof f6CapabilityBoundSchema>;
export type F6FeasibilityAssessment = z.infer<typeof f6FeasibilityAssessmentSchema>;
export type F6SupplierCapabilityEvidence = z.infer<typeof f6SupplierCapabilityEvidenceSchema>;
export type F6DatumEvidence = z.infer<typeof f6DatumEvidenceSchema>;
export type F6CostEvidence = z.infer<typeof f6CostEvidenceSchema>;
export type F6InputFinding = z.infer<typeof f6InputFindingSchema>;
export type F6Risk = z.infer<typeof f6RiskSchema>;
export type F6Recommendation = z.infer<typeof f6RecommendationSchema>;
export type F6Clarification = z.infer<typeof f6ClarificationSchema>;
export type F6TargetCapability = z.infer<typeof f6TargetCapabilitySchema>;
export type F6Option = z.infer<typeof f6OptionSchema>;
export type F6OptionV2 = z.infer<typeof f6OptionV2Schema>;
export type F6WorksheetInput = z.infer<typeof f6WorksheetInputSchema>;
export type F6OptimizationRequest = z.infer<typeof f6OptimizationRequestSchema>;
export type F6WorksheetResult = z.infer<typeof f6WorksheetResultSchema>;
export type F6Summary = z.infer<typeof f6SummarySchema>;
export type F6Provenance = z.infer<typeof f6ProvenanceSchema>;
export type F6LegacyOptimizationResult = z.infer<typeof f6LegacyOptimizationResultSchema>;
export type F6OptimizationResultV2 = z.infer<typeof f6OptimizationResultSchema>;
export type F6OptimizationResult = F6LegacyOptimizationResult;

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
export type F4WorkflowCalculationResult = z.infer<typeof f4WorkflowCalculationResultSchema>;
export type F4ExcelComparisonResult = z.infer<typeof f4ExcelComparisonResultSchema>;
export type CalculationLegacyUnavailableResult = z.infer<typeof calculationLegacyUnavailableResultSchema>;
export type DrawingGovernanceRequest = z.infer<typeof drawingGovernanceRequestSchema>;
export type DrawingGovernanceResult = z.infer<typeof drawingGovernanceResultSchema>;
export type InterpretationRequest = z.infer<typeof interpretationRequestSchema>;
export type InterpretationResult = z.infer<typeof interpretationResultSchema>;
export type F5CoreStructuralScope = z.infer<typeof f5CoreStructuralScopeSchema>;
export type F5ContextSnapshotRowV2 = z.infer<typeof f5ContextSnapshotRowV2Schema>;
export type F5ContextSnapshotV2 = z.infer<typeof f5ContextSnapshotV2Schema>;
export type F5VisualObservationV2 = z.infer<typeof f5VisualObservationV2Schema>;
export type F5ContextualSignalV2 = z.infer<typeof f5ContextualSignalV2Schema>;
export type F5ContextualObservationV2 = z.infer<typeof f5ContextualObservationV2Schema>;
export type F5ContextualObservationWorksheetV2 = z.infer<typeof f5ContextualObservationWorksheetV2Schema>;
export type F5ImageObservationArtifactV1 = z.infer<typeof f5ImageObservationArtifactV1Schema>;
export type F5ImageObservationArtifactV2 = z.infer<typeof f5ImageObservationArtifactV2Schema>;
export type F5ImageObservationArtifact = z.infer<typeof f5ImageObservationArtifactSchema>;
export type F5DataInterpretationRequest = z.infer<typeof f5DataInterpretationRequestSchema>;
export type F5DataInterpretationResult = z.infer<typeof f5DataInterpretationResultSchema>;
export type ComparisonRequest = z.infer<typeof comparisonRequestSchema>;
export type ComparisonResult = z.infer<typeof comparisonResultSchema>;
export type CpkRequest = z.infer<typeof cpkRequestSchema>;
export type CpkResult = z.infer<typeof cpkResultSchema>;
export type PublicWorkflowRequest = z.infer<typeof workflowRequestSchema>;
export type PublicWorkflowResult = z.infer<typeof workflowResultSchema>;
