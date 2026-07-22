import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditStore, hashUtf8, type AuditStore } from "@ai-assist/audit";
import { createTypedError } from "@ai-assist/contracts";
import { SkillRegistry, type RegisteredSkill } from "@ai-assist/skill-sdk";
import { expect, it } from "vitest";
import { runSmokeWorkflow, runWorkflow } from "./index.js";
import { runWorkflowForTest } from "./run-orchestrator.test-support.js";

interface SmokeRequest {
  readonly version: 1;
  readonly kind: "public-smoke-request";
  readonly data: {
    readonly message: string;
    readonly classification: "public";
  };
}

interface SmokeExpected {
  readonly version: 1;
  readonly kind: "public-smoke-expected";
  readonly skillIds: string[];
  readonly manifestValid: boolean;
}

it("creates a verifiable public run with two Skills", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const request = JSON.parse(await readFile(new URL("../../../fixtures/public/smoke-request.json", import.meta.url), "utf8")) as SmokeRequest;
  const expected = JSON.parse(await readFile(new URL("../../../fixtures/public/smoke-expected.json", import.meta.url), "utf8")) as SmokeExpected;

  try {
    const result = await runSmokeWorkflow({ rootDir, request });

    expect(result.skillResults).toHaveLength(2);
    expect(result.skillResults.map((entry) => entry.skillId)).toEqual(expected.skillIds);
    expect(result.skillResults[0]?.output).toEqual({ message: request.data.message });
    expect(result.manifestValid).toBe(expected.manifestValid);
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/);

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

it("rejects an arbitrary runner in the public workflow options", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  let bypassExecuted = false;
  registry.register(createTestSkill("governed-skill", false, async () => ({ governed: true })));

  try {
    // @ts-expect-error Arbitrary execution callbacks are not part of the public API.
    const thrown = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "governed-skill" }],
      runner: async () => {
        bypassExecuted = true;
        return { skillId: "governed-skill", output: { bypassed: true } };
      },
    }).catch((error: unknown) => error) as Error & { code: string };

    expect(bypassExecuted).toBe(false);
    expect(thrown.code).toBe("policy_denied");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("normalizes a foreign typed Skill error to the current run and records a correlated failure", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  const foreignRunId = "11111111-1111-4111-8111-111111111111";
  registry.register(createTestSkill("denied-skill", false, async () => {
    throw createTypedError({
      code: "policy_denied",
      runId: foreignRunId,
      summary: "The requested operation is denied.",
      suggestedAction: "Use a public-only workflow.",
      affectedInputReferences: [],
    });
  }));

  try {
    const thrown = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "denied-skill" }],
    }).catch((error: unknown) => error);

    const failedRun = thrown as Error & { code: string; runId: string; runDirectory: string };
    expect(failedRun.code).toBe("policy_denied");
    expect(failedRun.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(failedRun.runId).not.toBe(foreignRunId);
    const audit = await createAuditStore(failedRun.runDirectory);
    await expect(audit.hasEventType("skill_failed")).resolves.toBe(true);
    await expect(audit.verify()).resolves.toEqual({ valid: true, failures: [] });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("records only monotonic run-level lifecycle state transitions", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  registry.register(createTestSkill("first-skill", false, async () => ({ first: true })));
  registry.register(createTestSkill("second-skill", false, async () => ({ second: true })));

  try {
    const result = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "first-skill" }, { skillId: "second-skill" }],
    });
    const auditContents = await readFile(join(result.runDirectory, "events.jsonl"), "utf8");
    const events = auditContents.trim().split("\n").map((line) => JSON.parse(line) as { type: string; payloadHash: string });
    const statePayloads = [
      { runId: result.runId, state: "created" },
      { runId: result.runId, state: "policy_checked", stepCount: 2 },
      { runId: result.runId, state: "running", skillId: "first-skill", attempt: 1 },
      { runId: result.runId, state: "completed" },
    ];
    const states = statePayloads.filter((payload) => events.some((event) => event.payloadHash === hashUtf8(JSON.stringify(payload))))
      .map((payload) => payload.state);

    expect(states).toEqual(["created", "policy_checked", "running", "completed"]);
    expect(events.filter((event) => event.type === "skill_completed")).toHaveLength(3);
    expect(events.filter((event) => event.type === "skill_started")).toHaveLength(2);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("normalizes audit sealing failures to a current-run dependency error", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  registry.register(createTestSkill("seal-skill", false, async () => ({ sealed: false })));

  try {
    const thrown = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "seal-skill" }],
    }, {
      auditStoreFactory: async (runDirectory) => failingSealAuditStore(await createAuditStore(runDirectory)),
    }).catch((error: unknown) => error) as Error & { code: string; runId: string; runDirectory: string };

    expect(thrown.code).toBe("dependency_error");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.runDirectory).toContain(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("preserves the primary Skill error when audit sealing also fails", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  registry.register(createTestSkill("failing-skill", false, async () => {
    throw createTypedError({
      code: "policy_denied",
      summary: "The requested operation is denied.",
      suggestedAction: "Use a public-only workflow.",
      affectedInputReferences: [],
    });
  }));

  try {
    const thrown = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "failing-skill" }],
    }, {
      auditStoreFactory: async (runDirectory) => failingSealAuditStore(await createAuditStore(runDirectory)),
    }).catch((error: unknown) => error) as Error & {
      code: string;
      runId: string;
      auditError?: { code: string; runId: string };
    };

    expect(thrown.code).toBe("policy_denied");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.auditError).toEqual({
      code: "dependency_error",
      runId: thrown.runId,
      summary: "Audit sealing or verification failed.",
      suggestedAction: "Inspect the run storage and retry the workflow after the audit dependency is available.",
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("retries only retryable transient Skills with finite exponential backoff", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  let attempts = 0;
  const delays: number[] = [];
  registry.register(createTestSkill("retryable-skill", true, async () => {
    attempts += 1;
    if (attempts < 3) {
      throw createTypedError({
        code: "transient_error",
        summary: "Temporary mock failure.",
        retryable: true,
        suggestedAction: "Retry the operation.",
        affectedInputReferences: [],
      });
    }
    return { attempts };
  }));

  try {
    const result = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "retryable-skill" }],
    }, {
      delay: async (milliseconds) => { delays.push(milliseconds); },
    });

    expect(attempts).toBe(3);
    expect(delays).toEqual([10, 20]);
    expect(result.skillResults).toEqual([{ skillId: "retryable-skill", output: { attempts: 3 } }]);
    expect(result.manifestValid).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

function createTestSkill(
  skillId: string,
  retryable: boolean,
  execute: RegisteredSkill["execute"],
): RegisteredSkill {
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
    execute,
  };
}

function failingSealAuditStore(audit: AuditStore): AuditStore {
  return {
    ...audit,
    async writeManifest() {
      throw new Error("audit storage unavailable");
    },
  };
}