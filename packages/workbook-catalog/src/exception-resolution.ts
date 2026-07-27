import {
  createTypedError,
  exceptionResolutionRequestSchema,
  exceptionResolutionResultSchema,
  type ExceptionResolutionResult,
} from "@ai-assist/contracts";

const REQUEST_SUMMARY = "Exception resolution request is invalid.";
const POLICY_SUMMARY = "Exception resolution input is not permitted.";
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type PendingReason = "missing_candidate" | "duplicate_candidate" | "invalid_candidate";
type DerivedSignal = { readonly signalRef: string; readonly snapshot: Record<string, unknown> };

function requestError(summary: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide valid confidential exception-resolution evidence.",
    affectedInputReferences: ["exception-resolution"],
  });
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function signalReference(
  workbookContentHash: string,
  worksheetName: string,
  tableId: string,
  sourceRow: number,
  signalKind: string,
): string {
  return [workbookContentHash, worksheetName, tableId, sourceRow, signalKind].join("|");
}

function candidateIsValid(candidate: { readonly recordedBy: string; readonly recordedAt: string; readonly rationale: string }): boolean {
  return candidate.recordedBy.trim().length > 0
    && candidate.rationale.trim().length > 0
    && UTC_TIMESTAMP.test(candidate.recordedAt)
    && !Number.isNaN(Date.parse(candidate.recordedAt));
}

function createResult(value: unknown): ExceptionResolutionResult {
  const parsed = exceptionResolutionResultSchema.safeParse(value);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(parsed.data));
}

export function createExceptionResolution(request: unknown): ExceptionResolutionResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw requestError(REQUEST_SUMMARY);
  }
  if (typeof classification === "string" && classification !== "confidential") {
    throw requestError(POLICY_SUMMARY, "policy_denied");
  }

  const parsed = exceptionResolutionRequestSchema.safeParse(request);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  const input = parsed.data;
  const capabilityValidation = input.capabilityValidation;
  const signals: DerivedSignal[] = [];

  for (const row of capabilityValidation.rows) {
    const source = {
      worksheetName: row.worksheetName,
      tableId: row.tableId,
      sourceRow: row.sourceRow,
      factorName: row.factorName,
    };
    const addSignal = (signalKind: string, signal: Record<string, unknown>) => {
      signals.push({
        signalRef: signalReference(
          capabilityValidation.workbookContentHash,
          row.worksheetName,
          row.tableId,
          row.sourceRow,
          signalKind,
        ),
        snapshot: { signalKind, ...source, signal },
      });
    };

    if (row.tolerance.status === "out_of_library") {
      addSignal("tolerance_out_of_library", row.tolerance);
    } else if (row.tolerance.status === "unable_to_validate") {
      addSignal("tolerance_unable_to_validate", row.tolerance);
    }
    if (row.distribution.status === "distribution_mismatch") {
      addSignal("distribution_mismatch", row.distribution);
    } else if (row.distribution.status === "unable_to_validate") {
      addSignal("distribution_unable_to_validate", row.distribution);
    }
  }

  const candidatesBySignal = new Map<string, typeof input.candidates>();
  let invalidCandidateCount = 0;
  for (const candidate of input.candidates) {
    if (!signals.some((signal) => signal.signalRef === candidate.signalRef)) {
      invalidCandidateCount += 1;
      continue;
    }
    const candidates = candidatesBySignal.get(candidate.signalRef) ?? [];
    candidates.push(candidate);
    candidatesBySignal.set(candidate.signalRef, candidates);
  }

  const acceptedExceptions: Record<string, unknown>[] = [];
  const pendingExceptions: Record<string, unknown>[] = [];
  for (const signal of signals) {
    const candidates = candidatesBySignal.get(signal.signalRef) ?? [];
    let pendingReason: PendingReason | undefined;
    if (candidates.length === 0) {
      pendingReason = "missing_candidate";
    } else if (candidates.length > 1) {
      pendingReason = "duplicate_candidate";
      invalidCandidateCount += candidates.length;
    } else {
      const [candidate] = candidates;
      if (candidate === undefined || !candidateIsValid(candidate)) {
        pendingReason = "invalid_candidate";
        invalidCandidateCount += 1;
      } else {
        acceptedExceptions.push({
          signalRef: candidate.signalRef,
          recordedBy: candidate.recordedBy.trim(),
          recordedAt: candidate.recordedAt,
          rationale: candidate.rationale.trim(),
          snapshot: signal.snapshot,
        });
      }
    }
    if (pendingReason !== undefined) {
      pendingExceptions.push({ signalRef: signal.signalRef, reasonCode: pendingReason, snapshot: signal.snapshot });
    }
  }

  const readyToContinue = pendingExceptions.length === 0 && invalidCandidateCount === 0;
  return createResult({
    contractVersion: "v1",
    inputClassification: "confidential",
    status: readyToContinue ? "readyToContinue" : "pendingExceptions",
    readyToContinue,
    workbookContentHash: capabilityValidation.workbookContentHash,
    knowledgeBaseVersion: capabilityValidation.knowledgeBaseVersion,
    acceptedExceptions,
    pendingExceptions,
    summary: {
      actionableSignalCount: signals.length,
      acceptedExceptionCount: acceptedExceptions.length,
      pendingExceptionCount: pendingExceptions.length,
      invalidCandidateCount,
    },
  });
}