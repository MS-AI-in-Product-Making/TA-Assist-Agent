import { createTypedError, type DataClassification, typedErrorSchema } from "@ai-assist/contracts";
import { evaluatePolicy, getFeatureStatus } from "@ai-assist/governance";
import { SkillRegistry, type SkillAdapter, type SkillPermission } from "./registry.js";

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

function runtimeError(
  runId: string | undefined,
  code: "validation_error" | "policy_denied" | "feature_not_available" | "internal_error",
  summary: string,
  suggestedAction: string,
): Error {
  return createTypedError({
    code,
    ...(runId === undefined ? {} : { runId }),
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

export async function runRegisteredSkill(
  request: SkillRunRequest,
  registryOrOptions: SkillRegistry | SkillRunOptions,
): Promise<SkillRunResult> {
  if (typeof request !== "object" || request === null || !request.skillId) {
    throw runtimeError(undefined, "validation_error", "Malformed Skill run request.", "Provide a Skill ID.");
  }

  const options = resolveOptions(registryOrOptions);
  const { registry } = options;
  const runId = request.runId;

  const skill = registry.get(request.skillId);

  if (skill === undefined) {
    throw runtimeError(runId, "policy_denied", "Skill is not registered.", "Use a trusted registered Skill.");
  }

  const feature = getFeatureStatus(skill.manifest.featureId);
  if (feature?.status !== "available") {
    throw createTypedError({
      code: "feature_not_available", ...(runId === undefined ? {} : { runId }),
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

  try {
    const output = await skill.execute({
      input: Object.freeze({ ...(request.input ?? {}) }),
      adapters: Object.freeze({ ...(options.adapters ?? {}) }),
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