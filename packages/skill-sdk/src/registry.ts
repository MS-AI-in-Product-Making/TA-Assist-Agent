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
export type ImmutableSkillManifest = Omit<SkillManifest, "inputClassification" | "permissions" | "auditEventTypes"> & {
  readonly inputClassification: readonly DataClassification[];
  readonly permissions: readonly SkillPermission[];
  readonly auditEventTypes: readonly ("skill_started" | "skill_completed")[];
};

export interface SkillAdapter {
  execute(action: string): Promise<unknown>;
}

export interface SkillRuntimeContext {
  readonly input: Readonly<Record<string, unknown>>;
  readonly adapters: Readonly<Record<string, SkillAdapter>>;
}

export interface RegisteredSkill {
  readonly manifest: ImmutableSkillManifest;
  readonly trusted: true;
  execute(context: SkillRuntimeContext): Promise<Record<string, unknown>>;
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

    const manifest: ImmutableSkillManifest = Object.freeze({
      ...skill.manifest,
      inputClassification: Object.freeze([...skill.manifest.inputClassification]),
      permissions: Object.freeze([...skill.manifest.permissions]),
      auditEventTypes: Object.freeze([...skill.manifest.auditEventTypes]),
    });
    this.#skills.set(manifest.skillId, Object.freeze({
      trusted: true,
      manifest,
      execute: skill.execute,
    }));
  }

  get(skillId: string): RegisteredSkill | undefined {
    return this.#skills.get(skillId);
  }
}

export function isSupportedClassification(
  manifest: ImmutableSkillManifest,
  inputClassification: DataClassification,
): boolean {
  return manifest.inputClassification.includes(inputClassification);
}