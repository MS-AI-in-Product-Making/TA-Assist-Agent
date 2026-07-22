import type { RegisteredSkill } from "@ai-assist/skill-sdk";

export const publicEchoSkill: RegisteredSkill = {
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
      throw new Error("public-echo requires a string message.");
    }

    return { message: input.message };
  },
};