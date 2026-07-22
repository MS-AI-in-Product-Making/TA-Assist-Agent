import type { DataClassification } from "@ai-assist/contracts";
import { z } from "zod";

export const skillPermissionSchema = z.enum([
  "persist",
  "network",
  "adapter",
  "read",
]);

export const skillManifestSchema = z.object({
  skillId: z.string().min(1),
  version: z.literal("v1"),
  featureId: z.string().min(1),
  inputClassification: z.array(z.enum(["public", "internal", "confidential", "secret"])).min(1),
  permissions: z.array(skillPermissionSchema),
  idempotent: z.boolean(),
  retryable: z.boolean(),
  auditEventTypes: z.array(z.enum(["skill_started", "skill_completed"])).min(1),
});

export type SkillPermission = z.infer<typeof skillPermissionSchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema>;

export interface RegisteredSkill {
  readonly manifest: SkillManifest;
  readonly trusted: true;
  execute(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export class SkillRegistry {
  readonly #skills = new Map<string, RegisteredSkill>();

  register(skill: RegisteredSkill): void {
    skillManifestSchema.parse(skill.manifest);

    if (skill.trusted !== true) {
      throw new Error("Only trusted skills may be registered.");
    }

    if (this.#skills.has(skill.manifest.skillId)) {
      throw new Error(`Skill '${skill.manifest.skillId}' is already registered.`);
    }

    this.#skills.set(skill.manifest.skillId, skill);
  }

  get(skillId: string): RegisteredSkill | undefined {
    return this.#skills.get(skillId);
  }
}

export function isSupportedClassification(
  manifest: SkillManifest,
  inputClassification: DataClassification,
): boolean {
  return manifest.inputClassification.includes(inputClassification);
}