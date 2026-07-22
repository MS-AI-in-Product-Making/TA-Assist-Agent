import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditStore } from "@ai-assist/audit";
import { createTypedError } from "@ai-assist/contracts";
import { SkillRegistry, type RegisteredSkill } from "@ai-assist/skill-sdk";
import { expect, it } from "vitest";
import { runSmokeWorkflow, runWorkflow } from "./index.js";

it("creates a verifiable public run with two Skills", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const request = JSON.parse(await readFile(new URL("../../../fixtures/public/smoke-request.json", import.meta.url), "utf8")) as {
    data: { message: string; classification: string };
  };
  const expected = JSON.parse(await readFile(new URL("../../../fixtures/public/smoke-expected.json", import.meta.url), "utf8")) as {
    skillIds: string[];
    manifestValid: boolean;
  };

  try {
    const result = await runSmokeWorkflow({ rootDir });

    expect(result.skillResults).toHaveLength(2);
    expect(result.skillResults.map((entry) => entry.skillId)).toEqual(expected.skillIds);
    expect(result.manifestValid).toBe(expected.manifestValid);
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(request.data).toEqual({ message: "public smoke", classification: "public" });

    const audit = await createAuditStore(result.runDirectory);
    await expect(audit.verify()).resolves.toEqual({ valid: true, failures: [] });
    await expect(audit.hasEventType("run_created")).resolves.toBe(true);
    await expect(audit.hasEventType("policy_evaluated")).resolves.toBe(true);
    await expect(audit.hasEventType("skill_started")).resolves.toBe(true);
    await expect(audit.hasEventType("skill_completed")).resolves.toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("records a terminal Skill failure and preserves the original typed error", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  const failure = createTypedError({
    code: "policy_denied",
    summary: "The requested operation is denied.",
    suggestedAction: "Use a public-only workflow.",
    affectedInputReferences: [],
  });
  registry.register(createTestSkill("denied-skill", false));

  try {
    const thrown = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "denied-skill" }],
      runner: async () => {
        throw failure;
      },
    }).catch((error: unknown) => error);

    expect(thrown).toBe(failure);
    const failedRun = thrown as typeof failure & { runDirectory: string };
    const audit = await createAuditStore(failedRun.runDirectory);
    await expect(audit.hasEventType("skill_failed")).resolves.toBe(true);
    await expect(audit.verify()).resolves.toEqual({ valid: true, failures: [] });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("retries a retryable transient Skill at most twice", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  let attempts = 0;
  registry.register(createTestSkill("retryable-skill", true));

  try {
    const result = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "retryable-skill" }],
      runner: async (request) => {
        attempts += 1;
        if (attempts < 3) {
          throw createTypedError({
            code: "transient_error",
            runId: request.runId,
            summary: "Temporary mock failure.",
            retryable: true,
            suggestedAction: "Retry the operation.",
            affectedInputReferences: [],
          });
        }
        return { skillId: request.skillId, output: { attempts } };
      },
    });

    expect(attempts).toBe(3);
    expect(result.skillResults).toEqual([{ skillId: "retryable-skill", output: { attempts: 3 } }]);
    expect(result.manifestValid).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

function createTestSkill(skillId: string, retryable: boolean): RegisteredSkill {
  return {
    trusted: true,
    manifest: {
      skillId,
      version: "v1",
      featureId: "F8",
      inputClassification: ["public"],
      permissions: [],
      adapterCapabilities: [],
      idempotent: true,
      retryable,
      auditEventTypes: ["skill_started", "skill_completed"],
    },
    async execute() {
      return {};
    },
  };
}