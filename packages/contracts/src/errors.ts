import { z } from "zod";

export const errorCodeSchema = z.enum([
  "validation_error",
  "policy_denied",
  "feature_not_available",
  "dependency_error",
  "transient_error",
  "internal_error",
]);

export const typedErrorSchema = z.object({
  code: errorCodeSchema,
  runId: z.string().uuid(),
  summary: z.string().min(1),
  retryable: z.boolean(),
  suggestedAction: z.string().min(1),
  affectedInputReferences: z.array(z.string()),
});

export type TypedError = z.infer<typeof typedErrorSchema>;