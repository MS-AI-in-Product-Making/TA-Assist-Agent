import {
  createTypedError,
  unifiedExceptionResolutionV2RequestSchema,
  unifiedExceptionResolutionV2ResultSchema,
  type UnifiedExceptionResolutionResult,
} from "@ai-assist/contracts";

const REQUEST_SUMMARY = "Unified exception resolution request is invalid.";
const POLICY_SUMMARY = "Unified exception resolution input is not permitted.";
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type DerivedSignal = { readonly signalRef: string; readonly snapshot: Record<string, unknown> };

function requestError(summary: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({ code, summary, suggestedAction: "Provide valid confidential unified exception evidence.", affectedInputReferences: ["capability-validation", "identifier-quality-check"] });
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function candidateIsValid(candidate: { readonly recordedBy: string; readonly recordedAt: string; readonly rationale: string }): boolean {
  return candidate.recordedBy.trim().length > 0 && candidate.rationale.trim().length > 0 && UTC_TIMESTAMP.test(candidate.recordedAt) && !Number.isNaN(Date.parse(candidate.recordedAt));
}

function createResult(value: unknown): UnifiedExceptionResolutionResult {
  const parsed = unifiedExceptionResolutionV2ResultSchema.safeParse(value);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(parsed.data));
}

export function createUnifiedExceptionResolution(request: unknown): UnifiedExceptionResolutionResult {
  let classification: unknown;
  try { classification = (request as { inputClassification?: unknown })?.inputClassification; } catch { throw requestError(REQUEST_SUMMARY); }
  if (typeof classification === "string" && classification !== "confidential") throw requestError(POLICY_SUMMARY, "policy_denied");
  const parsed = unifiedExceptionResolutionV2RequestSchema.safeParse(request);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  const input = parsed.data;
  const signals: DerivedSignal[] = [];
  const hash = input.capabilityValidation.workbookContentHash;

  for (const row of input.capabilityValidation.rows) {
    const add = (signalKind: string, signal: Record<string, unknown>) => signals.push({
      signalRef: [hash, "capability_validation", row.worksheetName, row.tableId, row.sourceRow, signalKind].join("|"),
      snapshot: { source: "capability_validation", signalKind, worksheetName: row.worksheetName, tableId: row.tableId, sourceRow: row.sourceRow, factorName: row.factorName, signal },
    });
    if (row.tolerance.status === "out_of_library") add("tolerance_out_of_library", row.tolerance);
    else if (row.tolerance.status === "unable_to_validate") add("tolerance_unable_to_validate", row.tolerance);
    if (row.distribution.status === "distribution_mismatch") add("distribution_mismatch", row.distribution);
    else if (row.distribution.status === "unable_to_validate") add("distribution_unable_to_validate", row.distribution);
  }
  for (const signal of input.identifierQualityCheck.signals) {
    const discriminator = signal.signalKind === "identifier_evidence_unavailable" ? signal.reasonCode : signal.signalKind === "dim_id_duplicate" ? signal.normalizedDimId : "";
    signals.push({
      signalRef: [hash, "identifier_quality", signal.worksheetName, signal.tableId, signal.field, signal.signalKind, discriminator].join("|"),
      snapshot: { source: "identifier_quality", ...signal },
    });
  }

  const candidatesBySignal = new Map<string, typeof input.candidates>();
  let invalidCandidateCount = 0;
  for (const candidate of input.candidates) {
    if (!signals.some((signal) => signal.signalRef === candidate.signalRef)) { invalidCandidateCount += 1; continue; }
    const candidates = candidatesBySignal.get(candidate.signalRef) ?? [];
    candidates.push(candidate);
    candidatesBySignal.set(candidate.signalRef, candidates);
  }

  const acceptedExceptions: Record<string, unknown>[] = [];
  const pendingExceptions: Record<string, unknown>[] = [];
  for (const signal of signals) {
    const candidates = candidatesBySignal.get(signal.signalRef) ?? [];
    if (candidates.length === 0) {
      pendingExceptions.push({ signalRef: signal.signalRef, reasonCode: "missing_candidate", snapshot: signal.snapshot });
    } else if (candidates.length > 1) {
      invalidCandidateCount += candidates.length;
      pendingExceptions.push({ signalRef: signal.signalRef, reasonCode: "duplicate_candidate", snapshot: signal.snapshot });
    } else {
      const candidate = candidates[0]!;
      if (!candidateIsValid(candidate)) {
        invalidCandidateCount += 1;
        pendingExceptions.push({ signalRef: signal.signalRef, reasonCode: "invalid_candidate", snapshot: signal.snapshot });
      } else {
        acceptedExceptions.push({ signalRef: candidate.signalRef, recordedBy: candidate.recordedBy.trim(), recordedAt: candidate.recordedAt, rationale: candidate.rationale.trim(), snapshot: signal.snapshot });
      }
    }
  }

  const acceptedCapabilityExceptionCount = acceptedExceptions.filter((entry) => (entry.snapshot as { source: string }).source === "capability_validation").length;
  const pendingCapabilityExceptionCount = pendingExceptions.filter((entry) => (entry.snapshot as { source: string }).source === "capability_validation").length;
  const acceptedIdentifierExceptionCount = acceptedExceptions.length - acceptedCapabilityExceptionCount;
  const pendingIdentifierExceptionCount = pendingExceptions.length - pendingCapabilityExceptionCount;
  const readyToContinue = pendingExceptions.length === 0 && invalidCandidateCount === 0;
  return createResult({
    contractVersion: "v2", inputClassification: "confidential", status: readyToContinue ? "readyToContinue" : "pendingExceptions", readyToContinue,
    workbookContentHash: hash, knowledgeBaseVersion: input.capabilityValidation.knowledgeBaseVersion, acceptedExceptions, pendingExceptions,
    summary: {
      actionableSignalCount: signals.length, capabilitySignalCount: acceptedCapabilityExceptionCount + pendingCapabilityExceptionCount,
      identifierSignalCount: acceptedIdentifierExceptionCount + pendingIdentifierExceptionCount,
      acceptedExceptionCount: acceptedExceptions.length, acceptedCapabilityExceptionCount, acceptedIdentifierExceptionCount,
      pendingExceptionCount: pendingExceptions.length, pendingCapabilityExceptionCount, pendingIdentifierExceptionCount, invalidCandidateCount,
    },
  });
}
