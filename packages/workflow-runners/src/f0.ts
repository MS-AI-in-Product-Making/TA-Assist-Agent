import {
  loadInterpretationRules,
  loadInternalToleranceGuidance,
  loadKnowledgeBase,
  loadProcessRequirements,
} from "@ai-assist/knowledge-base";

import { normalizeRunnerError } from "./error-normalizer.js";
import type { F0ValidationResult, RunContext } from "./types.js";

export interface F0Dependencies {
  readonly loadKnowledgeBase?: (request: { version: "v1" }) => unknown;
  readonly loadInternalToleranceGuidance?: (request: { version: "internal-v1" }) => unknown;
  readonly loadInterpretationRules?: (request: { version: "interpretation-rules-v2" }) => unknown;
  readonly loadProcessRequirements?: (request: { version: "process-requirements-v1" }) => unknown;
}

const DEFAULT_VERSIONS = ["v1", "internal-v1", "interpretation-rules-v2", "process-requirements-v1"] as const;
type ManifestVersionField = "effectiveVersion" | "version";

function validateExactVersion(
  value: unknown,
  expected: typeof DEFAULT_VERSIONS[number],
  label: string,
  manifestField: ManifestVersionField,
): void {
  if (typeof value !== "object" || value === null) {
    throw new Error(`F0 ${label} manifest is missing.`);
  }
  const manifest = (value as { manifest?: unknown }).manifest;
  if (typeof manifest !== "object" || manifest === null) {
    throw new Error(`F0 ${label} manifest is missing.`);
  }
  const manifestValue = (manifest as Record<ManifestVersionField, unknown>)[manifestField];
  if (manifestValue !== expected) {
    throw new Error(`F0 ${label} version mismatch.`);
  }
}

function throwIfAborted(context: RunContext, stage: string): void {
  if (!context.signal.aborted) return;
  throw normalizeRunnerError(new Error(`AbortError: signal already aborted before ${stage}.`), {
    fallbackRunId: context.attemptId,
    affectedInputReferences: [stage],
  });
}

export function validateF0Capabilities(context: RunContext, dependencies: F0Dependencies = {}): F0ValidationResult {
  const stage = "validate_capabilities";
  try {
    throwIfAborted(context, stage);
    context.emit({ kind: "stage_started", featureId: "F0", stage, timestamp: new Date().toISOString() });
    const knowledgeBase = (dependencies.loadKnowledgeBase ?? loadKnowledgeBase)({ version: "v1" });
    const internal = (dependencies.loadInternalToleranceGuidance ?? loadInternalToleranceGuidance)({ version: "internal-v1" });
    const interpretation = (dependencies.loadInterpretationRules ?? loadInterpretationRules)({ version: "interpretation-rules-v2" });
    const processRequirements = (dependencies.loadProcessRequirements ?? loadProcessRequirements)({ version: "process-requirements-v1" });
    if (dependencies.loadKnowledgeBase !== undefined) validateExactVersion(knowledgeBase, "v1", "knowledge base", "effectiveVersion");
    if (dependencies.loadInternalToleranceGuidance !== undefined) validateExactVersion(internal, "internal-v1", "internal guidance", "effectiveVersion");
    if (dependencies.loadInterpretationRules !== undefined) validateExactVersion(interpretation, "interpretation-rules-v2", "interpretation rules", "effectiveVersion");
    if (dependencies.loadProcessRequirements !== undefined) validateExactVersion(processRequirements, "process-requirements-v1", "process requirements", "version");
    throwIfAborted(context, stage);
    const result: F0ValidationResult = {
      featureId: "F0",
      status: "completed",
      versions: DEFAULT_VERSIONS,
      artifactRoot: undefined,
    };
    context.emit({ kind: "stage_completed", featureId: "F0", stage, timestamp: new Date().toISOString() });
    return result;
  } catch (error) {
    throw normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: [stage] });
  }
}