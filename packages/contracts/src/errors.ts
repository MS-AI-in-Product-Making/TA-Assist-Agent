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

export type TypedErrorCode = z.infer<typeof errorCodeSchema>;

export interface TypedErrorOptions {
  readonly code: TypedErrorCode;
  readonly runId?: string;
  readonly summary: string;
  readonly retryable?: boolean;
  readonly suggestedAction: string;
  readonly affectedInputReferences?: readonly string[];
  readonly details?: Record<string, unknown>;
}

export function normalizeRunId(runId: string | undefined): string {
  return typeof runId === "string" && z.string().uuid().safeParse(runId).success
    ? runId
    : crypto.randomUUID();
}

export function createTypedError(options: TypedErrorOptions): Error & TypedError {
  return Object.assign(new Error(options.summary), {
    code: options.code,
    runId: normalizeRunId(options.runId),
    summary: options.summary,
    retryable: options.retryable ?? false,
    suggestedAction: options.suggestedAction,
    affectedInputReferences: [...(options.affectedInputReferences ?? [])],
    ...options.details,
  });
}