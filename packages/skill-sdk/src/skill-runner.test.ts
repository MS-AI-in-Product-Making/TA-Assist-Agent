import { expect, it } from "vitest";
import {
  type RegisteredSkill,
  runRegisteredSkill,
  SkillRegistry,
} from "./index.js";
import { classificationCheckSkill, publicEchoSkill } from "@ai-assist/skills";

it("denies undeclared network access", async () => {
  await expect(
    runRegisteredSkill({
      skillId: "network-test",
      requestedPermission: "network",
    }),
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
    }),
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