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

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const nonEmptyWorkbookBytesSchema = z.instanceof(Uint8Array).refine(
  (workbookBytes) => workbookBytes.length > 0,
  { message: "workbookBytes must not be empty" },
);

export const worksheetAnalysisAssetsRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    workbookBytes: nonEmptyWorkbookBytesSchema,
    workbookCatalog: workbookCatalogResultSchema,
  })
  .strict();

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
export type WorkbookCatalogRequest = z.infer<typeof workbookCatalogRequestSchema>;
export type WorkbookCatalogResult = z.infer<typeof workbookCatalogResultSchema>;
export type WorksheetAnalysisAssetsRequest = z.infer<typeof worksheetAnalysisAssetsRequestSchema>;
export type WorksheetAnalysisAssetsResult = z.infer<typeof worksheetAnalysisAssetsResultSchema>;
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