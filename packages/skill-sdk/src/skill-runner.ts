import {
  createTypedError,
  normalizeRunId,
  type DataClassification,
  typedErrorSchema,
} from "@ai-assist/contracts";
import { evaluatePolicy, getFeatureStatus } from "@ai-assist/governance";
import {
  SkillRegistry,
  type SkillAdapter,
  type SkillAdapterCapability,
  type SkillPermission,
} from "./registry.js";

export interface SkillRunRequest {
  readonly skillId: string;
  readonly input?: Record<string, unknown>;
  readonly inputClassification?: DataClassification;
  readonly requestedPermission?: SkillPermission;
  readonly runId?: string;
}

export interface SkillRunResult {
  readonly skillId: string;
  readonly output: Record<string, unknown>;
}

export interface SkillRunOptions {
  readonly registry: SkillRegistry;
  readonly adapters?: Readonly<Record<string, SkillAdapter>>;
}

const adapterCapabilityPermissions: Readonly<Record<SkillAdapterCapability, SkillPermission>> = {
  echo: "read",
};

const adapterCapabilityActions: Readonly<Record<SkillAdapterCapability, readonly string[]>> = {
  echo: ["echo"],
};

function runtimeError(
  runId: string,
  code: "validation_error" | "policy_denied" | "feature_not_available" | "internal_error",
  summary: string,
  suggestedAction: string,
): Error {
  return createTypedError({
    code,
    runId,
    summary,
    suggestedAction,
    affectedInputReferences: [],
  });
}

function resolveOptions(registryOrOptions: SkillRegistry | SkillRunOptions): SkillRunOptions {
  return typeof (registryOrOptions as SkillRegistry).get === "function"
    ? { registry: registryOrOptions as SkillRegistry }
    : registryOrOptions as SkillRunOptions;
}

function resolveAdapterCapabilities(
  capabilities: readonly SkillAdapterCapability[],
  adapters: Readonly<Record<string, SkillAdapter>>,
  inputClassification: DataClassification,
  runId: string,
): Readonly<Record<string, SkillAdapter>> {
  const authorizedAdapters: Record<string, SkillAdapter> = {};

  for (const capability of capabilities) {
    const permission = adapterCapabilityPermissions[capability];
    const allowedActions = adapterCapabilityActions[capability];
    if (
      permission === undefined ||
      allowedActions === undefined ||
      !evaluatePolicy({ inputClassification, permission }).allowed
    ) {
      throw runtimeError(
        runId,
        "policy_denied",
        "Adapter capability is denied by policy.",
        "Use an adapter capability allowed for this input classification.",
      );
    }

    const adapter = adapters[capability];
    if (adapter !== undefined) {
      authorizedAdapters[capability] = Object.freeze({
        async execute(action: string): Promise<unknown> {
          if (!allowedActions.includes(action)) {
            throw runtimeError(
              runId,
              "policy_denied",
              "Adapter action is denied by policy.",
              "Use an action allowed by the adapter capability.",
            );
          }
          return adapter.execute(action);
        },
      });
    }
  }

  return Object.freeze(authorizedAdapters);
}

function isJsonCompatible(value: unknown, ancestors = new WeakSet<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    return false;
  }

  ancestors.add(value);
  try {
    const values = Array.isArray(value) ? value : Object.values(value);
    return values.every((entry) => isJsonCompatible(entry, ancestors));
  } finally {
    ancestors.delete(value);
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
    Object.freeze(value);
  }
  return value;
}

function createInputSnapshot(input: Record<string, unknown>, runId: string): Readonly<Record<string, unknown>> {
  try {
    if (!isJsonCompatible(input)) {
      throw new Error("Input is not JSON-compatible.");
    }
    return deepFreeze(structuredClone(input));
  } catch {
    throw runtimeError(
      runId,
      "validation_error",
      "Skill input must be JSON-compatible and acyclic.",
      "Provide a plain JSON-compatible input object without cyclic references.",
    );
  }
}

export async function runRegisteredSkill(
  request: SkillRunRequest,
  registryOrOptions: SkillRegistry | SkillRunOptions,
): Promise<SkillRunResult> {
  const runId = normalizeRunId(
    typeof request === "object" && request !== null ? request.runId : undefined,
  );
  if (typeof request !== "object" || request === null || !request.skillId) {
    throw runtimeError(runId, "validation_error", "Malformed Skill run request.", "Provide a Skill ID.");
  }

  const options = resolveOptions(registryOrOptions);
  const { registry } = options;

  const skill = registry.get(request.skillId);

  if (skill === undefined) {
    throw runtimeError(runId, "policy_denied", "Skill is not registered.", "Use a trusted registered Skill.");
  }

  const feature = getFeatureStatus(skill.manifest.featureId);
  if (feature?.status !== "available") {
    throw createTypedError({
      code: "feature_not_available", runId,
      summary: `Feature '${skill.manifest.featureId}' is not available.`,
      suggestedAction: "Use an available Feature or complete its enablement requirements.",
      affectedInputReferences: [],
      details: { featureId: skill.manifest.featureId, dependencies: feature?.dependsOn ?? [], enablementRequirements: feature?.externalPrerequisites ?? [] },
    });
  }

  const inputClassification = request.inputClassification ?? "public";
  if (!skill.manifest.inputClassification.includes(inputClassification)) {
    throw runtimeError(runId, "policy_denied", "Input classification is not allowed.", "Use an allowed input classification.");
  }

  if (
    request.requestedPermission !== undefined &&
    !skill.manifest.permissions.includes(request.requestedPermission)
  ) {
    throw runtimeError(runId, "policy_denied", "Requested permission is not declared.", "Request a declared permission.");
  }

  if (request.requestedPermission !== undefined && !evaluatePolicy({ inputClassification, permission: request.requestedPermission }).allowed) {
    throw runtimeError(runId, "policy_denied", "Requested permission is denied by policy.", "Request a policy-allowed permission.");
  }

  const adapters = resolveAdapterCapabilities(
    skill.manifest.adapterCapabilities,
    options.adapters ?? {},
    inputClassification,
    runId,
  );

  try {
    const output = await skill.execute({
      input: createInputSnapshot(request.input ?? {}, runId),
      adapters,
    });
    return { skillId: skill.manifest.skillId, output };
  } catch (error) {
    if (typedErrorSchema.safeParse(error).success) {
      throw error;
    }

    throw runtimeError(
      runId,
      "internal_error",
      "Skill execution failed unexpectedly.",
      "Correct the Skill input or contact the Skill owner.",
    );
  }
}