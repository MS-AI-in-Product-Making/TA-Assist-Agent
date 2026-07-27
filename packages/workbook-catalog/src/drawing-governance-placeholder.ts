import {
  createTypedError,
  drawingGovernanceRequestSchema,
  drawingGovernanceResultSchema,
  type DrawingGovernanceResult,
} from "@ai-assist/contracts";

const REQUEST_SUMMARY = "Drawing governance request is invalid.";
const POLICY_SUMMARY = "Drawing governance input is not permitted.";

function requestError(summary: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide valid confidential controlled references.",
    affectedInputReferences: ["drawing-governance-request-v1"],
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

function createResult(value: unknown): DrawingGovernanceResult {
  const parsed = drawingGovernanceResultSchema.safeParse(value);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(parsed.data));
}

export function createDrawingGovernancePlaceholder(request: unknown): DrawingGovernanceResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw requestError(REQUEST_SUMMARY);
  }
  if (typeof classification === "string" && classification !== "confidential") {
    throw requestError(POLICY_SUMMARY, "policy_denied");
  }

  const parsed = drawingGovernanceRequestSchema.safeParse(request);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  const input = parsed.data;

  return createResult({
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F3",
    status: "feature_not_available",
    projectReference: input.projectReference,
    runReference: input.runReference,
    worksheetReferences: input.worksheetReferences,
    requiredPrerequisites: ["approved-ado-access", "canonical-dim-id-policy"],
  });
}