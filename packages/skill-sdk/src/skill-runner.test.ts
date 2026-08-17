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

function expectTypedRegistrationError(register: () => void, code: "validation_error" | "policy_denied"): void {
  try {
    register();
    throw new Error("Expected registration to fail.");
  } catch (error) {
    expect(typedErrorSchema.safeParse(error).success).toBe(true);
    expect(error).toMatchObject({ code });
  }
}

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

  expectTypedRegistrationError(() => registry.register(publicEchoSkill), "validation_error");
  expectTypedRegistrationError(() =>
    registry.register({
      ...publicEchoSkill,
      manifest: { ...publicEchoSkill.manifest, skillId: "untrusted-echo" },
      trusted: false,
    } as unknown as RegisteredSkill),
  "policy_denied");
});

it("keeps an immutable manifest snapshot after registration", async () => {
  const registry = new SkillRegistry();
  const echo = new MockAdapter({ accepted: true });
  const manifest = {
    ...publicEchoSkill.manifest,
    skillId: "immutable-echo",
    inputClassification: ["public"],
    permissions: ["persist"],
    adapterCapabilities: [...publicEchoSkill.manifest.adapterCapabilities],
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
  manifest.adapterCapabilities.pop();
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

  await expect(
    runRegisteredSkill(
      { skillId: "immutable-echo", input: { message: "public" } },
      { registry, adapters: { echo } },
    ),
  ).resolves.toMatchObject({ output: { message: "public" } });
  expect(echo.invocations).toEqual(["echo"]);
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
      skillId: "f7-skill",
      featureId: "F7",
      permissions: [],
    },
    async execute() {
      executed = true;
      return {};
    },
  });

  await expect(
    runRegisteredSkill({ skillId: "f7-skill" }, registry),
  ).rejects.toMatchObject({ code: "feature_not_available" });
  expect(executed).toBe(false);
});

it("runs the actual public echo Skill through a named mock adapter", async () => {
  const registry = new SkillRegistry();
  registry.register(publicEchoSkill);
  const adapter = new MockAdapter({ accepted: true });

  await expect(
    runRegisteredSkill(
      { skillId: "public-echo", input: { message: "hello" } },
      { registry, adapters: { echo: adapter } },
    ),
  ).resolves.toMatchObject({ output: { message: "hello" } });
  expect(adapter.invocations).toEqual(["echo"]);
  expect((publicEchoSkill.manifest as { adapterCapabilities?: unknown }).adapterCapabilities).toEqual(["echo"]);
});

it("does not expose undeclared adapters to the Skill handler", async () => {
  const registry = new SkillRegistry();
  const echo = new MockAdapter({ accepted: true });
  registry.register({
    trusted: true,
    manifest: {
      ...publicEchoSkill.manifest,
      skillId: "no-adapter-capability",
      permissions: [],
      adapterCapabilities: [],
    },
    async execute(context) {
      return { adapterNames: Object.keys(context.adapters) };
    },
  });

  await expect(
    runRegisteredSkill(
      { skillId: "no-adapter-capability" },
      { registry, adapters: { echo } },
    ),
  ).resolves.toMatchObject({ output: { adapterNames: [] } });
  expect(echo.invocations).toEqual([]);
});

it("denies a declared adapter capability when its policy action is denied", async () => {
  const registry = new SkillRegistry();
  let executed = false;
  registry.register({
    trusted: true,
    manifest: {
      ...publicEchoSkill.manifest,
      skillId: "internal-echo",
      inputClassification: ["internal"],
      permissions: [],
      adapterCapabilities: ["echo"],
    } as unknown as RegisteredSkill["manifest"],
    async execute() {
      executed = true;
      return {};
    },
  });

  await expect(
    runRegisteredSkill(
      { skillId: "internal-echo", inputClassification: "internal" },
      { registry, adapters: { echo: new MockAdapter({ accepted: true }) } },
    ),
  ).rejects.toMatchObject({ code: "policy_denied" });
  expect(executed).toBe(false);
});

it("exposes only the declared public echo adapter capability", async () => {
  const registry = new SkillRegistry();
  const echo = new MockAdapter({ accepted: true });
  const unrecognized = new MockAdapter({ accepted: false });
  registry.register({
    trusted: true,
    manifest: {
      ...publicEchoSkill.manifest,
      skillId: "adapter-allowlist",
      permissions: [],
      adapterCapabilities: ["echo"],
    } as unknown as RegisteredSkill["manifest"],
    async execute(context) {
      await context.adapters.echo?.execute("echo");
      return { adapterNames: Object.keys(context.adapters) };
    },
  });

  await expect(
    runRegisteredSkill(
      { skillId: "adapter-allowlist" },
      {
        registry,
        adapters: { echo, unrecognized } as unknown as Record<string, MockAdapter<{ accepted: boolean }>>,
      },
    ),
  ).resolves.toMatchObject({ output: { adapterNames: ["echo"] } });
  expect(echo.invocations).toEqual(["echo"]);
  expect(unrecognized.invocations).toEqual([]);
});

it("denies undeclared echo adapter actions before they reach the underlying adapter", async () => {
  const registry = new SkillRegistry();
  const echo = new MockAdapter({ accepted: true });
  registry.register({
    trusted: true,
    manifest: {
      ...publicEchoSkill.manifest,
      skillId: "malicious-echo-action",
      permissions: [],
      adapterCapabilities: ["echo"],
    } as unknown as RegisteredSkill["manifest"],
    async execute(context) {
      await context.adapters.echo?.execute("network");
      return {};
    },
  });

  await expect(
    runRegisteredSkill(
      { skillId: "malicious-echo-action" },
      { registry, adapters: { echo } },
    ),
  ).rejects.toMatchObject({ code: "policy_denied" });
  expect(echo.invocations).toEqual([]);
});

it("uses a schema-valid run ID when rejecting a request with an invalid run ID", async () => {
  const registry = new SkillRegistry();

  await expect(
    runRegisteredSkill(
      { skillId: "unregistered", runId: "not-a-uuid" },
      registry,
    ),
  ).rejects.toSatisfy((error: unknown) => {
    const parsed = typedErrorSchema.safeParse(error);
    return parsed.success && parsed.data.code === "policy_denied";
  });
});

it("passes a deeply frozen input clone to the Skill", async () => {
  const registry = new SkillRegistry();
  const input = { nested: { value: "original" } };
  registry.register({
    trusted: true,
    manifest: {
      ...publicEchoSkill.manifest,
      skillId: "immutable-input",
      permissions: [],
      adapterCapabilities: [],
    } as unknown as RegisteredSkill["manifest"],
    async execute(context) {
      let mutationBlocked = false;
      try {
        (context.input.nested as { value: string }).value = "changed";
      } catch {
        mutationBlocked = true;
      }
      return { mutationBlocked, value: (context.input.nested as { value: string }).value };
    },
  });

  await expect(
    runRegisteredSkill({ skillId: "immutable-input", input }, registry),
  ).resolves.toMatchObject({
    output: { mutationBlocked: true, value: "original" },
  });
  expect(input).toEqual({ nested: { value: "original" } });
});

it("fails closed with typed validation errors for cyclic and unsupported inputs", async () => {
  const registry = new SkillRegistry();
  let executed = false;
  registry.register({
    trusted: true,
    manifest: {
      ...publicEchoSkill.manifest,
      skillId: "input-boundary",
      permissions: [],
      adapterCapabilities: [],
    } as unknown as RegisteredSkill["manifest"],
    async execute() {
      executed = true;
      return {};
    },
  });
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;

  for (const input of [cyclic, { callback: () => undefined }]) {
    await expect(
      runRegisteredSkill({ skillId: "input-boundary", input }, registry),
    ).rejects.toSatisfy((error: unknown) => {
      const parsed = typedErrorSchema.safeParse(error);
      return parsed.success && parsed.data.code === "validation_error";
    });
  }
  expect(executed).toBe(false);
});

it("normalizes all registry registration failures to typed errors", () => {
  const invalidManifestRegistry = new SkillRegistry();
  const untrustedRegistry = new SkillRegistry();
  const duplicateRegistry = new SkillRegistry();
  duplicateRegistry.register(publicEchoSkill);

  const failures = [
    () => invalidManifestRegistry.register({
      ...publicEchoSkill,
      manifest: { ...publicEchoSkill.manifest, skillId: "" },
    }),
    () => untrustedRegistry.register({
      ...publicEchoSkill,
      manifest: { ...publicEchoSkill.manifest, skillId: "untrusted-error" },
      trusted: false,
    } as unknown as RegisteredSkill),
    () => duplicateRegistry.register(publicEchoSkill),
  ];

  for (const register of failures) {
    expectTypedRegistrationError(register, register === failures[1] ? "policy_denied" : "validation_error");
  }
});

it("normalizes invalid optional registry run IDs in exported errors", () => {
  const registry = new SkillRegistry();

  expectTypedRegistrationError(
    () => registry.register({
      ...publicEchoSkill,
      manifest: { ...publicEchoSkill.manifest, skillId: "" },
    }, "not-a-uuid"),
    "validation_error",
  );
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