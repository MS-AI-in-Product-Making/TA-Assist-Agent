import { SkillRegistry } from "@ai-assist/skill-sdk";
import { classificationCheckSkill } from "./classification-skill.js";
import { publicEchoSkill } from "./echo-skill.js";

export function createAnonymousSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  registry.register(publicEchoSkill);
  registry.register(classificationCheckSkill);
  return registry;
}