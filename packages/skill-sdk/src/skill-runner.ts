import type { DataClassification } from "@ai-assist/contracts";
import { SkillRegistry, type RegisteredSkill, type SkillPermission } from "./registry.js";

const runtimeRunId = "00000000-0000-4000-8000-000000000001";

export interface SkillRunRequest {
  readonly skillId: string;
  readonly input?: Record<string, unknown>;
  readonly inputClassification?: DataClassification;
  readonly requestedPermission?: SkillPermission;
}

export interface SkillRunResult {
  readonly skillId: string;
  readonly output: Record<string, unknown>;
}

export interface SkillRuntimeError extends Error {
  readonly code: "validation_error" | "policy_denied" | "feature_not_available";
  readonly runId: string;
  readonly summary: string;
  readonly retryable: false;
  readonly suggestedAction: string;
  readonly affectedInputReferences: readonly string[];
}

function runtimeError(
  code: SkillRuntimeError["code"],
  summary: string,
  suggestedAction: string,
): SkillRuntimeError {
  return Object.assign(new Error(summary), {
    code,
    runId: runtimeRunId,
    summary,
    retryable: false as const,
    suggestedAction,
    affectedInputReferences: [],
  });
}

const publicEchoSkill: RegisteredSkill = {
  trusted: true,
  manifest: {
    skillId: "public-echo",
    version: "v1",
    featureId: "F8",
    inputClassification: ["public"],
    permissions: ["persist"],
    idempotent: true,
    retryable: false,
    auditEventTypes: ["skill_started", "skill_completed"],
  },
  async execute(input) {
    if (typeof input.message !== "string") {
      throw runtimeError(
        "validation_error",
        "public-echo requires a string message.",
        "Provide input.message as a string.",
      );
    }

    return { message: input.message };
  },
};

const defaultRegistry = new SkillRegistry();
defaultRegistry.register(publicEchoSkill);

export async function runRegisteredSkill(
  request: SkillRunRequest,
  registry: SkillRegistry = defaultRegistry,
): Promise<SkillRunResult> {
  if (typeof request !== "object" || request === null || !request.skillId) {
    throw runtimeError("validation_error", "Malformed Skill run request.", "Provide a Skill ID.");
  }

  const skill = registry.get(request.skillId);

  if (skill === undefined) {
    throw runtimeError("policy_denied", "Skill is not registered.", "Use a trusted registered Skill.");
  }

  const inputClassification = request.inputClassification ?? "public";
  if (!skill.manifest.inputClassification.includes(inputClassification)) {
    throw runtimeError("policy_denied", "Input classification is not allowed.", "Use an allowed input classification.");
  }

  if (
    request.requestedPermission !== undefined &&
    !skill.manifest.permissions.includes(request.requestedPermission)
  ) {
    throw runtimeError("policy_denied", "Requested permission is not declared.", "Request a declared permission.");
  }

  try {
    const output = await skill.execute(request.input ?? {});
    return { skillId: skill.manifest.skillId, output };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "validation_error" ||
        error.code === "policy_denied" ||
        error.code === "feature_not_available")
    ) {
      throw error;
    }

    throw runtimeError(
      "validation_error",
      "Skill input is invalid.",
      "Correct the Skill input and retry.",
    );
  }
}