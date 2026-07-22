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

export type DataClassification = z.infer<typeof dataClassificationSchema>;
export type RunRequest = z.infer<typeof runRequestSchema>;