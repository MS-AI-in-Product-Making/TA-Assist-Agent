import type { RegisteredSkill } from "@ai-assist/skill-sdk";

export const classificationCheckSkill: RegisteredSkill = {
  trusted: true,
  manifest: {
    skillId: "classification-check",
    version: "v1",
    featureId: "F8.public-smoke",
    inputClassification: ["public", "internal", "confidential"],
    permissions: [],
    adapterCapabilities: [],
    idempotent: true,
    retryable: false,
    auditEventTypes: ["skill_started", "skill_completed"],
  },
  async execute(context) {
    const classification = context.input.classification;
    if (classification !== "public" && classification !== "internal" && classification !== "confidential") {
      throw new Error("classification-check requires a supported classification.");
    }

    return {
      classification,
      retention: classification === "confidential" ? "explicit_opt_in" : "allowed",
    };
  },
};