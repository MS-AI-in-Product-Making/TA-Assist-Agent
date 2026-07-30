import { z } from "zod";

export const errorCodeSchema = z.enum([
  "validation_error",
  "policy_denied",
  "evidence_mismatch",
  "prerequisite_not_ready",
  "calculation_not_possible",
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

export type TypedError = Readonly<Omit<z.infer<typeof typedErrorSchema>, "affectedInputReferences"> & {
  readonly affectedInputReferences: readonly string[];
}>;

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

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) deepFreeze(descriptor.value, seen);
  }
  return Object.freeze(value);
}

export function createTypedError(options: TypedErrorOptions): Error & TypedError {
  return deepFreeze(Object.assign(new Error(options.summary), {
    code: options.code,
    runId: normalizeRunId(options.runId),
    summary: options.summary,
    retryable: options.retryable ?? false,
    suggestedAction: options.suggestedAction,
    affectedInputReferences: [...(options.affectedInputReferences ?? [])],
    ...options.details,
  }));
}