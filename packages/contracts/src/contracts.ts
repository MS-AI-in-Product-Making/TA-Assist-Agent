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
    ruleId: z.enum(["cts-sigma", "ctf-sigma", "default-cpk-target"]),
  })
  .strict();

export const terminologyQuerySchema = z
  .object({
    termType: z.enum(["part-category", "subsystem", "datum"]),
    value: z.string().min(1),
  })
  .strict();

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