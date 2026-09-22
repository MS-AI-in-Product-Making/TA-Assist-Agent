import { createTypedError } from "@ai-assist/contracts";
import type { RegisteredSkill } from "@ai-assist/skill-sdk";

export const publicEchoSkill: RegisteredSkill = {
  trusted: true,
  manifest: {
    skillId: "public-echo",
    version: "v1",
    featureId: "F8.public-smoke",
    inputClassification: ["public"],
    permissions: ["persist"],
    adapterCapabilities: ["echo"],
    idempotent: true,
    retryable: false,
    auditEventTypes: ["skill_started", "skill_completed"],
  },
  async execute(context) {
    if (typeof context.input.message !== "string") {
      throw createTypedError({
        code: "validation_error",
        summary: "public-echo requires a string message.",
        suggestedAction: "Provide input.message as a string.",
        affectedInputReferences: ["input.message"],
      });
    }

    if (context.adapters.echo !== undefined) {
      await context.adapters.echo.execute("echo");
    }

    return { message: context.input.message };
  },
};