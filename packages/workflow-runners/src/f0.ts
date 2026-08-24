import { loadInterpretationRules, loadInternalToleranceGuidance, loadKnowledgeBase } from "@ai-assist/knowledge-base";

import type { F0ValidationResult, RunContext } from "./types.js";

export interface F0Dependencies {
  readonly loadKnowledgeBase?: (request: { version: "v1" }) => unknown;
  readonly loadInternalToleranceGuidance?: (request: { version: "internal-v1" }) => unknown;
  readonly loadInterpretationRules?: (request: { version: "interpretation-rules-v1" }) => unknown;
}

const DEFAULT_VERSIONS = ["v1", "internal-v1", "interpretation-rules-v1"] as const;

function versionOf(value: unknown, fallback: typeof DEFAULT_VERSIONS[number]): typeof DEFAULT_VERSIONS[number] {
  if (typeof value === "object" && value !== null) {
    const manifestValue = (value as { manifest?: { effectiveVersion?: unknown } }).manifest?.effectiveVersion;
    if (manifestValue === fallback) return fallback;
    const manifest = (value as { getKnowledgeBaseManifest?: () => { knowledgeBaseVersion?: unknown } }).getKnowledgeBaseManifest?.();
    if (manifest?.knowledgeBaseVersion === fallback) return fallback;
  }
  return fallback;
}

export function validateF0Capabilities(context: RunContext, dependencies: F0Dependencies = {}): F0ValidationResult {
  context.emit({ kind: "stage_started", featureId: "F0", stage: "validate_capabilities", timestamp: new Date().toISOString() });
  const knowledgeBase = (dependencies.loadKnowledgeBase ?? loadKnowledgeBase)({ version: "v1" });
  const internal = (dependencies.loadInternalToleranceGuidance ?? loadInternalToleranceGuidance)({ version: "internal-v1" });
  const interpretation = (dependencies.loadInterpretationRules ?? loadInterpretationRules)({ version: "interpretation-rules-v1" });
  if (versionOf(knowledgeBase, "v1") !== "v1") throw new Error("F0 knowledge base version mismatch.");
  if (versionOf(internal, "internal-v1") !== "internal-v1") throw new Error("F0 internal guidance version mismatch.");
  if (versionOf(interpretation, "interpretation-rules-v1") !== "interpretation-rules-v1") throw new Error("F0 interpretation rules version mismatch.");
  const result: F0ValidationResult = {
    featureId: "F0",
    status: "completed",
    versions: DEFAULT_VERSIONS,
    artifactRoot: undefined,
  };
  context.emit({ kind: "stage_completed", featureId: "F0", stage: "validate_capabilities", timestamp: new Date().toISOString() });
  return result;
}