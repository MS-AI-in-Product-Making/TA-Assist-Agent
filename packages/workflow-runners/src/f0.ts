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
  readonly loadProcessRequirements?: (request: { version: "process-requirements-v3" }) => unknown;
}

const DEFAULT_VERSIONS = ["v1", "internal-v1", "interpretation-rules-v2", "process-requirements-v3"] as const;
type ManifestVersionField = "effectiveVersion" | "version";
type InjectedLoaders = {
  readonly [Loader in keyof Required<F0Dependencies>]: F0Dependencies[Loader];
};

function readInjectedLoaders(dependencies: F0Dependencies): InjectedLoaders {
  try {
    return {
      loadKnowledgeBase: dependencies.loadKnowledgeBase,
      loadInternalToleranceGuidance: dependencies.loadInternalToleranceGuidance,
      loadInterpretationRules: dependencies.loadInterpretationRules,
      loadProcessRequirements: dependencies.loadProcessRequirements,
    };
  } catch {
    throw new Error("F0 dependency injection failed unexpectedly.");
  }
}

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

function validateProcessRequirementsCapability(value: unknown): void {
  if (typeof value !== "object" || value === null) {
    throw new Error("F0 process requirements capability is missing.");
  }
  const capability = value as Record<string, unknown>;
  if (typeof capability.evaluateProcessRequirements !== "function"
    || typeof capability.listProcessRequirements !== "function") {
    throw new Error("F0 process requirements capability is missing.");
  }
  const evaluation = capability.evaluateProcessRequirements({});
  if (typeof evaluation !== "object" || evaluation === null
    || (evaluation as { version?: unknown }).version !== "process-requirements-v3") {
    throw new Error("F0 process requirements evaluation version mismatch.");
  }
  const entries = capability.listProcessRequirements({});
  if (!Array.isArray(entries) || entries.some((entry) => (
    typeof entry !== "object"
      || entry === null
      || typeof (entry as { provenance?: unknown }).provenance !== "object"
      || (entry as { provenance: { effectiveVersion?: unknown } }).provenance.effectiveVersion
        !== "process-requirements-v3"
  ))) {
    throw new Error("F0 process requirements entry version mismatch.");
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
    const injectedLoaders = readInjectedLoaders(dependencies);
    const injectedKnowledgeBaseLoader = injectedLoaders.loadKnowledgeBase;
    const injectedInternalGuidanceLoader = injectedLoaders.loadInternalToleranceGuidance;
    const injectedInterpretationRulesLoader = injectedLoaders.loadInterpretationRules;
    const injectedProcessRequirementsLoader = injectedLoaders.loadProcessRequirements;
    throwIfAborted(context, stage);
    context.emit({ kind: "stage_started", featureId: "F0", stage, timestamp: new Date().toISOString() });
    const knowledgeBase = (injectedKnowledgeBaseLoader ?? loadKnowledgeBase)({ version: "v1" });
    const internal = (injectedInternalGuidanceLoader ?? loadInternalToleranceGuidance)({ version: "internal-v1" });
    const interpretation = (injectedInterpretationRulesLoader ?? loadInterpretationRules)({ version: "interpretation-rules-v2" });
    const processRequirements = (injectedProcessRequirementsLoader ?? loadProcessRequirements)({ version: "process-requirements-v3" });
    if (injectedKnowledgeBaseLoader !== undefined) validateExactVersion(knowledgeBase, "v1", "knowledge base", "effectiveVersion");
    if (injectedInternalGuidanceLoader !== undefined) validateExactVersion(internal, "internal-v1", "internal guidance", "effectiveVersion");
    if (injectedInterpretationRulesLoader !== undefined) validateExactVersion(interpretation, "interpretation-rules-v2", "interpretation rules", "effectiveVersion");
    if (injectedProcessRequirementsLoader !== undefined) {
      validateExactVersion(processRequirements, "process-requirements-v3", "process requirements", "version");
      validateProcessRequirementsCapability(processRequirements);
    }
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