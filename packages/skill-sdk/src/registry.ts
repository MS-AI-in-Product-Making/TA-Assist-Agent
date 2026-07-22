import { createTypedError, type DataClassification } from "@ai-assist/contracts";
import { z } from "zod";

export const skillPermissionSchema = z.enum([
  "persist",
  "network",
  "adapter",
  "read",
]);

export const skillAdapterCapabilitySchema = z.enum(["echo"]);

export const skillManifestSchema = z.object({
  skillId: z.string().min(1),
  version: z.literal("v1"),
  featureId: z.string().min(1),
  inputClassification: z.array(z.enum(["public", "internal", "confidential", "secret"])).min(1),
  permissions: z.array(skillPermissionSchema),
  adapterCapabilities: z.array(skillAdapterCapabilitySchema),
  idempotent: z.boolean(),
  retryable: z.boolean(),
  auditEventTypes: z.array(z.enum(["skill_started", "skill_completed"])).min(1),
});

export type SkillPermission = z.infer<typeof skillPermissionSchema>;
export type SkillAdapterCapability = z.infer<typeof skillAdapterCapabilitySchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema>;
export type ImmutableSkillManifest = Omit<SkillManifest, "inputClassification" | "permissions" | "adapterCapabilities" | "auditEventTypes"> & {
  readonly inputClassification: readonly DataClassification[];
  readonly permissions: readonly SkillPermission[];
  readonly adapterCapabilities: readonly SkillAdapterCapability[];
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

  register(skill: RegisteredSkill, runId?: string): void {
    const parsedManifest = skillManifestSchema.safeParse(skill.manifest);

    if (!parsedManifest.success) {
      throw createTypedError({
        code: "validation_error",
        ...(runId === undefined ? {} : { runId }),
        summary: "Skill manifest is invalid.",
        suggestedAction: "Provide a manifest that satisfies the Skill contract.",
        affectedInputReferences: parsedManifest.error.issues.map((issue) => issue.path.join(".")),
      });
    }

    if (skill.trusted !== true) {
      throw createTypedError({
        code: "policy_denied",
        ...(runId === undefined ? {} : { runId }),
        summary: "Only trusted Skills may be registered.",
        suggestedAction: "Register a trusted Skill from an approved package.",
        affectedInputReferences: [],
      });
    }

    if (this.#skills.has(parsedManifest.data.skillId)) {
      throw createTypedError({
        code: "validation_error",
        ...(runId === undefined ? {} : { runId }),
        summary: `Skill '${parsedManifest.data.skillId}' is already registered.`,
        suggestedAction: "Register each Skill ID only once.",
        affectedInputReferences: ["manifest.skillId"],
      });
    }

    const manifest: ImmutableSkillManifest = Object.freeze({
      ...parsedManifest.data,
      inputClassification: Object.freeze([...parsedManifest.data.inputClassification]),
      permissions: Object.freeze([...parsedManifest.data.permissions]),
      adapterCapabilities: Object.freeze([...parsedManifest.data.adapterCapabilities]),
      auditEventTypes: Object.freeze([...parsedManifest.data.auditEventTypes]),
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