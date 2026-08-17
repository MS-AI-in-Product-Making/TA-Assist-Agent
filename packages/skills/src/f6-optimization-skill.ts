import type { RegisteredSkill } from "@ai-assist/skill-sdk";
import { createF6Optimization } from "@ai-assist/workbook-catalog";

export const f6OptimizationSkill: RegisteredSkill = {
  trusted: true,
  manifest: {
    skillId: "f6-optimization",
    version: "v1",
    featureId: "F6",
    inputClassification: ["confidential"],
    permissions: [],
    adapterCapabilities: [],
    idempotent: true,
    retryable: false,
    auditEventTypes: ["skill_started", "skill_completed"],
  },
  async execute(context) {
    return createF6Optimization(context.input);
  },
};