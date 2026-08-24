import { createTypedError, typedErrorSchema, type TypedError } from "@ai-assist/contracts";

export interface NormalizeRunnerErrorOptions {
  readonly fallbackRunId?: string;
  readonly affectedInputReferences?: readonly string[];
}

const ABORT_PATTERN = /(aborterror|aborted|cancelled|canceled|signal already aborted)/i;
const EVIDENCE_PATTERN = /(manifest|hash|identity|stale_worksheet_selection|workbookcontenthash|content hash|downstream scope|scope mismatch|artifact root mismatch|evidence mismatch|version mismatch)/i;
const VALIDATION_PATTERN = /(requires|unsupported|missing|invalid|unsafe|does not exist|exactly one|empty|unknown option|unexpected argument)/i;
const DEPENDENCY_PATTERN = /(cannot find module|enoent|spawn .* enoent|not installed)/i;
const TRANSIENT_PATTERN = /(timed out|econnreset|eai_again|temporar(?:y|ily)|try again)/i;

function sanitizedSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (ABORT_PATTERN.test(message)) return "Workflow execution was cancelled.";
  if (EVIDENCE_PATTERN.test(message)) return "Evidence validation failed.";
  if (VALIDATION_PATTERN.test(message)) return message;
  if (DEPENDENCY_PATTERN.test(message)) return "A required workflow dependency is unavailable.";
  if (TRANSIENT_PATTERN.test(message)) return "A temporary workflow failure occurred.";
  return "Workflow runner failed unexpectedly.";
}

export function normalizeRunnerError(error: unknown, options: NormalizeRunnerErrorOptions = {}): Error & TypedError {
  const typed = typedErrorSchema.safeParse(error);
  if (typed.success && error instanceof Error) return error as Error & TypedError;
  if (typed.success) {
    return createTypedError({
      code: typed.data.code,
      runId: typed.data.runId,
      summary: typed.data.summary,
      retryable: typed.data.retryable,
      suggestedAction: typed.data.suggestedAction,
      affectedInputReferences: typed.data.affectedInputReferences,
    });
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = ABORT_PATTERN.test(message)
    ? "transient_error"
    : EVIDENCE_PATTERN.test(message)
    ? "evidence_mismatch"
    : VALIDATION_PATTERN.test(message)
      ? "validation_error"
      : DEPENDENCY_PATTERN.test(message)
        ? "dependency_error"
        : TRANSIENT_PATTERN.test(message)
          ? "transient_error"
          : "internal_error";

  return createTypedError({
    code,
    summary: sanitizedSummary(error),
    retryable: code === "transient_error",
    suggestedAction: code === "transient_error"
      ? "Retry the workflow only after the cancellation condition has cleared."
      : code === "evidence_mismatch"
      ? "Confirm workbook identity, manifest integrity, and selected worksheet scope before retrying."
      : code === "validation_error"
        ? "Correct the workflow inputs and rerun the stage."
        : code === "dependency_error"
          ? "Restore the missing dependency and rerun the stage."
          : "Inspect the runner logs and retry only after the failure is understood.",
    affectedInputReferences: [...(options.affectedInputReferences ?? [])],
    ...(options.fallbackRunId ? { runId: options.fallbackRunId } : {}),
  });
}