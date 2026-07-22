import { expect, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import { MockAdapter } from "@ai-assist/adapters";
import {
  type RegisteredSkill,
  runRegisteredSkill,
  SkillRegistry,
} from "./index.js";
import {
  classificationCheckSkill,
  createAnonymousSkillRegistry,
  publicEchoSkill,
} from "@ai-assist/skills";

it("denies undeclared network access", async () => {
  await expect(
    runRegisteredSkill({
      skillId: "network-test",
      requestedPermission: "network",
    }, createAnonymousSkillRegistry()),
  ).rejects.toMatchObject({
    code: "policy_denied",
    summary: "Skill is not registered.",
  });
});

it("runs the public echo Skill through a controlled adapter", async () => {
  await expect(
    runRegisteredSkill({
      skillId: "public-echo",
      input: { message: "hello" },
    }, createAnonymousSkillRegistry()),
  ).resolves.toMatchObject({
    skillId: "public-echo",
    output: { message: "hello" },
  });
});

it("runs registered classification checks without granting external permissions", async () => {
  const registry = new SkillRegistry();
  registry.register(classificationCheckSkill);

  await expect(
    runRegisteredSkill(
      {
        skillId: "classification-check",
        input: { classification: "confidential" },
        inputClassification: "confidential",
      },
      registry,
    ),
  ).resolves.toMatchObject({
    skillId: "classification-check",
    output: { classification: "confidential", retention: "explicit_opt_in" },
  });
});

it("fails closed for secret inputs and malformed requests", async () => {
  const registry = new SkillRegistry();
  registry.register(publicEchoSkill);

  await expect(
    runRegisteredSkill(
      {
        skillId: "public-echo",
        input: { message: "secret" },
        inputClassification: "secret",
      },
      registry,
    ),
  ).rejects.toMatchObject({ code: "policy_denied" });

  await expect(
    runRegisteredSkill({ skillId: "public-echo", input: { message: 42 } }, registry),
  ).rejects.toMatchObject({ code: "validation_error" });
});

it("rejects duplicate and untrusted registrations", () => {
  const registry = new SkillRegistry();
  registry.register(publicEchoSkill);

  expect(() => registry.register(publicEchoSkill)).toThrow("already registered");
  expect(() =>
    registry.register({
      ...publicEchoSkill,
      manifest: { ...publicEchoSkill.manifest, skillId: "untrusted-echo" },
      trusted: false,
    } as unknown as RegisteredSkill),
  ).toThrow("Only trusted skills");
});

it("keeps an immutable manifest snapshot after registration", async () => {
  const registry = new SkillRegistry();
  const manifest = {
    ...publicEchoSkill.manifest,
    skillId: "immutable-echo",
    inputClassification: ["public"],
    permissions: ["persist"],
    auditEventTypes: ["skill_started", "skill_completed"],
  };
  const skill: RegisteredSkill = {
    ...publicEchoSkill,
    manifest,
  };
  registry.register(skill);

  manifest.featureId = "F4";
  manifest.inputClassification.push("secret");
  manifest.permissions.push("network");
  manifest.auditEventTypes.push("skill_started");

  await expect(
    runRegisteredSkill(
      {
        skillId: "immutable-echo",
        input: { message: "classified" },
        inputClassification: "secret",
      },
      registry,
    ),
  ).rejects.toMatchObject({ code: "policy_denied" });

  await expect(
    runRegisteredSkill(
      { skillId: "immutable-echo", requestedPermission: "network" },
      registry,
    ),
  ).rejects.toMatchObject({ code: "policy_denied" });
});

it("denies declared persist through the policy gate", async () => {
  const registry = new SkillRegistry();
  registry.register(publicEchoSkill);

  await expect(
    runRegisteredSkill(
      { skillId: "public-echo", requestedPermission: "persist" },
      registry,
    ),
  ).rejects.toMatchObject({
    code: "policy_denied",
    suggestedAction: expect.any(String),
  });
});

it("does not execute a trusted Skill for an unavailable Feature", async () => {
  const registry = new SkillRegistry();
  let executed = false;
  registry.register({
    trusted: true,
    manifest: {
      ...publicEchoSkill.manifest,
      skillId: "f4-skill",
      featureId: "F4",
      permissions: [],
    },
    async execute() {
      executed = true;
      return {};
    },
  });

  await expect(
    runRegisteredSkill({ skillId: "f4-skill" }, registry),
  ).rejects.toMatchObject({ code: "feature_not_available" });
  expect(executed).toBe(false);
});

it("runs the actual public echo Skill through a named mock adapter", async () => {
  const registry = new SkillRegistry();
  registry.register(publicEchoSkill);
  const adapter = new MockAdapter({ accepted: true });
  const execute = runRegisteredSkill as unknown as (
    request: Parameters<typeof runRegisteredSkill>[0],
    options: { registry: SkillRegistry; adapters: { echo: MockAdapter<{ accepted: boolean }> } },
  ) => ReturnType<typeof runRegisteredSkill>;

  await expect(
    execute(
      { skillId: "public-echo", input: { message: "hello" } },
      { registry, adapters: { echo: adapter } },
    ),
  ).resolves.toMatchObject({ output: { message: "hello" } });
  expect(adapter.invocations).toEqual(["echo"]);
});

it("normalizes malformed Skill handler failures to the typed error contract", async () => {
  const registry = new SkillRegistry();
  registry.register({
    trusted: true,
    manifest: {
      ...publicEchoSkill.manifest,
      skillId: "malformed-error",
      permissions: [],
    },
    async execute() {
      throw { unexpected: true };
    },
  });

  await expect(
    runRegisteredSkill({ skillId: "malformed-error" }, registry),
  ).rejects.toSatisfy((error: unknown) => typedErrorSchema.safeParse(error).success);
});