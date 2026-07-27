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