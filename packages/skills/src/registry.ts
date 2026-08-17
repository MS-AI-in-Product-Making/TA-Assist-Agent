import { SkillRegistry } from "@ai-assist/skill-sdk";
import { classificationCheckSkill } from "./classification-skill.js";
import { publicEchoSkill } from "./echo-skill.js";
import { f6OptimizationSkill } from "./f6-optimization-skill.js";

export function createAnonymousSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  registry.register(publicEchoSkill);
  registry.register(classificationCheckSkill);
  registry.register(f6OptimizationSkill);
  return registry;
}